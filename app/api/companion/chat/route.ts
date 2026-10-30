import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { companionUsage } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAILY_LIMIT = 10;
const MAX_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_PERSONAL_KEY_LENGTH = 256;
const MODEL = "gemini-3.5-flash-lite";

type ChatMessage = { role: "user" | "model"; text: string };

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

function apiErrorStatus(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const err = (value as { error?: unknown }).error;
  if (typeof err !== "object" || err === null) return "";
  const status = (err as { status?: unknown }).status;
  return typeof status === "string" ? status.toUpperCase() : "";
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
          contents: messages.map(({ role, text }) => ({ role, parts: [{ text }] })),
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
      if (response.status === 429) {
        return NextResponse.json(
          { error: usingPersonalKey ? "personal_quota" : "provider_quota" },
          { status: 429 },
        );
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: usingPersonalKey ? "personal_key" : "configuration" },
          { status: 503 },
        );
      }
      if (response.status === 503 || response.status >= 500) {
        return NextResponse.json(
          { error: usingPersonalKey ? "personal_unavailable" : "provider_unavailable" },
          { status: 503 },
        );
      }
      const status = apiErrorStatus(providerBody);
      if (status === "RESOURCE_EXHAUSTED" || status === "UNAVAILABLE") {
        return NextResponse.json(
          { error: usingPersonalKey ? "personal_quota" : "provider_quota" },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: usingPersonalKey ? "personal_unavailable" : "provider_unavailable" },
        { status: 503 },
      );
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
    if (!reply) return NextResponse.json({ error: "provider_unavailable" }, { status: 503 });
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      { error: usingPersonalKey ? "personal_unavailable" : "provider_unavailable" },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
