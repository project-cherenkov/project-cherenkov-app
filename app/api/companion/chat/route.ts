import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { companionSettings, companionUsage } from "@/lib/db/schema";
import { COMPANION_DAILY_LIMIT, COMPANION_MAX_HISTORY, COMPANION_MAX_MESSAGE_CHARS } from "@/lib/companion-settings";
import { classifyProviderFailure, normaliseConversation, type ChatMessage } from "@/lib/companion-chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAILY_LIMIT = COMPANION_DAILY_LIMIT;
const MAX_MESSAGES = COMPANION_MAX_HISTORY;
const MAX_MESSAGE_LENGTH = COMPANION_MAX_MESSAGE_CHARS;
const MAX_PERSONAL_KEY_LENGTH = 256;
const MODEL = "gemini-3.5-flash-lite";

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) return null;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const record = item as Record<string, unknown>;
    if ((record.role !== "user" && record.role !== "model") || typeof record.text !== "string") return null;
    const text = record.text.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) return null;
    messages.push({ role: record.role, text });
  }
  if (messages[messages.length - 1]?.role !== "user") return null;
  return messages;
}

// Gives back the request that was counted when the provider did not answer, so
// a failure on the provider's side does not use up one of the student's few
// daily requests. Best effort: if this write fails the request simply stays
// counted, which is how every failure behaved before.
async function refundRequest(userId: string, usageDay: string) {
  try {
    await db
      .update(companionUsage)
      .set({ requestCount: sql`greatest(${companionUsage.requestCount} - 1, 0)` })
      .where(and(eq(companionUsage.userId, userId), eq(companionUsage.usageDay, usageDay)));
  } catch {
    // Nothing more to do.
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 40_000) return NextResponse.json({ error: "invalid" }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const messages = parseMessages(record.messages);
  const personalKey = record.personalKey;
  if (
    !messages ||
    (personalKey !== undefined &&
      (typeof personalKey !== "string" || personalKey.length > MAX_PERSONAL_KEY_LENGTH || record.personalKeyConsent !== true))
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // The student can switch the AI off in Neutrino's settings. Enforce it here
  // too, so a stale tab or a hand-made request cannot send a message anyway.
  // No settings row means the default (on). Checked before the daily budget so
  // a refused request never uses up a request.
  try {
    const [setting] = await db
      .select({ aiEnabled: companionSettings.aiEnabled })
      .from(companionSettings)
      .where(eq(companionSettings.userId, user.id))
      .limit(1);
    if (setting && !setting.aiEnabled) return NextResponse.json({ error: "ai_disabled" }, { status: 403 });
    const [acknowledgement] = await db
      .select({ aiAcknowledged: companionSettings.aiAcknowledged })
      .from(companionSettings)
      .where(eq(companionSettings.userId, user.id))
      .limit(1);
    if (!acknowledgement?.aiAcknowledged) return NextResponse.json({ error: "acknowledgement_required" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const key = typeof personalKey === "string" && personalKey.trim()
    ? personalKey.trim()
    : process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "configuration" }, { status: 503 });

  // An atomic upsert enforces a UTC daily user limit across serverless
  // instances. It applies equally when the user supplies a request-only key.
  const usageDay = new Date().toISOString().slice(0, 10);
  try {
    const [usage] = await db
      .insert(companionUsage)
      .values({ userId: user.id, usageDay, requestCount: 1 })
      .onConflictDoUpdate({
        target: [companionUsage.userId, companionUsage.usageDay],
        set: { requestCount: sql`${companionUsage.requestCount} + 1` },
        setWhere: sql`${companionUsage.requestCount} < ${DAILY_LIMIT}`,
      })
      .returning({ requestCount: companionUsage.requestCount });
    if (!usage) return NextResponse.json({ error: "cherenkov_limit" }, { status: 429 });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const usingPersonalKey = typeof personalKey === "string" && personalKey.trim().length > 0;
  // Every failure from here on is the provider's (or the network's), not the
  // student's, so it gives the counted request back.
  const fail = async (error: string, status: number) => {
    await refundRequest(user.id, usageDay);
    return NextResponse.json({ error }, { status });
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "You are Neutrino, a concise study companion for Project Cherenkov, an Indonesian olympiad learning site for informatics, physics, and astronomy. Help the student understand concepts and reason through problems. Prefer hints, explanations, examples, and checking their work over giving unexplained answers. Reply in the student's language. Stay focused on learning. If unsure, say so. Keep replies brief and do not claim to know Cherenkov content that was not provided.",
              },
            ],
          },
          contents: normaliseConversation(messages).map(({ role, text }) => ({ role, parts: [{ text }] })),
          generationConfig: { maxOutputTokens: 256, temperature: 0.4 },
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    let providerBody: unknown = null;
    try {
      providerBody = await response.json();
    } catch {
      // Treat an unreadable provider response as a temporary provider error.
    }

    if (!response.ok) {
      const failure = classifyProviderFailure(response.status, providerBody, usingPersonalKey);
      return fail(failure.error, failure.status);
    }

    const candidates = (providerBody as { candidates?: unknown } | null)?.candidates;
    const candidate = Array.isArray(candidates) ? candidates[0] : null;
    const content = typeof candidate === "object" && candidate !== null
      ? (candidate as { content?: unknown }).content
      : null;
    const parts = typeof content === "object" && content !== null
      ? (content as { parts?: unknown }).parts
      : null;
    const reply = Array.isArray(parts)
      ? parts
          .map((part) => (typeof part === "object" && part !== null ? (part as { text?: unknown }).text : ""))
          .filter((part): part is string => typeof part === "string")
          .join("")
          .trim()
      : "";
    if (!reply) return fail("provider_unavailable", 503);
    return NextResponse.json({ reply });
  } catch {
    return fail(usingPersonalKey ? "personal_unavailable" : "provider_unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }
}
