import { NextResponse } from "next/server";
import { and, count, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { companionChatMessages, companionChats, companionSettings, companionUsage } from "@/lib/db/schema";
import {
  COMPANION_DAILY_LIMIT,
  COMPANION_MAX_HISTORY,
  COMPANION_MAX_MESSAGE_CHARS,
  COMPANION_MAX_OUTPUT_TOKENS,
  COMPANION_PERSONAL_DAILY_LIMIT,
} from "@/lib/companion-settings";
import { classifyProviderFailure, normaliseConversation, wasTruncated, type ChatMessage } from "@/lib/companion-chat";
import { chatTitleFromMessage, checkChatLimits, isChatId } from "@/lib/companion-chat-history";
import { buildSystemPrompt, parsePageContextRef } from "@/lib/companion-prompt";
import { listContentIndex, resolvePageContext } from "@/lib/companion-page-context";

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
// daily requests. It decrements whichever counter was incremented. Best effort:
// if this write fails the request simply stays counted.
async function refundRequest(userId: string, usageDay: string, personal: boolean) {
  try {
    await db
      .update(companionUsage)
      .set(
        personal
          ? { personalRequestCount: sql`greatest(${companionUsage.personalRequestCount} - 1, 0)` }
          : { requestCount: sql`greatest(${companionUsage.requestCount} - 1, 0)` },
      )
      .where(and(eq(companionUsage.userId, userId), eq(companionUsage.usageDay, usageDay)));
  } catch {
    // Nothing more to do.
  }
}

class ChatConflict extends Error {
  constructor(readonly code: "chat_limit" | "chat_conflict") {
    super(code);
  }
}

// Saves the student's message and Neutrino's reply together, or neither. A new
// conversation creates its chat here, so a failed request never leaves an empty
// chat that uses up one of the saved-chat slots. The limits are checked again
// inside the transaction because two tabs can race.
async function saveExchange(options: {
  userId: string;
  chatId: string | null;
  userText: string;
  reply: string;
}): Promise<string> {
  return db.transaction(async (tx) => {
    let chatId = options.chatId;
    let position = 0;
    if (chatId === null) {
      const [{ total } = { total: 0 }] = await tx
        .select({ total: count() })
        .from(companionChats)
        .where(eq(companionChats.userId, options.userId));
      if (checkChatLimits({ chatId: null, chatCount: total, messageCount: 0 })) throw new ChatConflict("chat_limit");
      const [created] = await tx
        .insert(companionChats)
        .values({ userId: options.userId, title: chatTitleFromMessage(options.userText) })
        .returning({ id: companionChats.id });
      chatId = created!.id;
    } else {
      const [owned] = await tx
        .select({ id: companionChats.id })
        .from(companionChats)
        .where(and(eq(companionChats.id, chatId), eq(companionChats.userId, options.userId)))
        .limit(1);
      if (!owned) throw new ChatConflict("chat_conflict");
      const [{ total } = { total: 0 }] = await tx
        .select({ total: count() })
        .from(companionChatMessages)
        .where(eq(companionChatMessages.chatId, chatId));
      position = total;
    }
    try {
      await tx.insert(companionChatMessages).values([
        { chatId, position, role: "user", body: options.userText },
        { chatId, position: position + 1, role: "model", body: options.reply },
      ]);
    } catch {
      // The unique (chat, position) index: another tab wrote to this chat first.
      throw new ChatConflict("chat_conflict");
    }
    await tx.update(companionChats).set({ updatedAt: new Date() }).where(eq(companionChats.id, chatId));
    return chatId;
  });
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
  const chatId = record.chatId === undefined || record.chatId === null ? null : record.chatId;
  const pageRef = record.page === undefined ? null : parsePageContextRef(record.page);
  if (
    !messages ||
    (chatId !== null && !isChatId(chatId)) ||
    (record.page !== undefined && !pageRef) ||
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

  const usingPersonalKey = typeof personalKey === "string" && personalKey.trim().length > 0;
  const key = usingPersonalKey ? (personalKey as string).trim() : process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "configuration" }, { status: 503 });

  // Saved-chat limits come before the daily counter, so a refused request never
  // uses up a request. Every query is filtered by the signed-in user's id; a
  // chat that is not theirs is reported as not found, not as forbidden.
  try {
    if (chatId === null) {
      const [{ total } = { total: 0 }] = await db
        .select({ total: count() })
        .from(companionChats)
        .where(eq(companionChats.userId, user.id));
      const refusal = checkChatLimits({ chatId: null, chatCount: total, messageCount: 0 });
      if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });
    } else {
      const [owned] = await db
        .select({ id: companionChats.id })
        .from(companionChats)
        .where(and(eq(companionChats.id, chatId as string), eq(companionChats.userId, user.id)))
        .limit(1);
      if (!owned) return NextResponse.json({ error: "chat_not_found" }, { status: 404 });
      const [{ total } = { total: 0 }] = await db
        .select({ total: count() })
        .from(companionChatMessages)
        .where(eq(companionChatMessages.chatId, chatId as string));
      const refusal = checkChatLimits({ chatId: chatId as string, chatCount: 0, messageCount: total });
      if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // An atomic upsert enforces a UTC daily user limit across serverless
  // instances. A request with the student's own key is counted separately
  // (against a much larger ceiling), so it never uses up the shared allowance.
  const usageDay = new Date().toISOString().slice(0, 10);
  try {
    const [usage] = usingPersonalKey
      ? await db
          .insert(companionUsage)
          .values({ userId: user.id, usageDay, requestCount: 0, personalRequestCount: 1 })
          .onConflictDoUpdate({
            target: [companionUsage.userId, companionUsage.usageDay],
            set: { personalRequestCount: sql`${companionUsage.personalRequestCount} + 1` },
            setWhere: sql`${companionUsage.personalRequestCount} < ${COMPANION_PERSONAL_DAILY_LIMIT}`,
          })
          .returning({ requestCount: companionUsage.personalRequestCount })
      : await db
          .insert(companionUsage)
          .values({ userId: user.id, usageDay, requestCount: 1 })
          .onConflictDoUpdate({
            target: [companionUsage.userId, companionUsage.usageDay],
            set: { requestCount: sql`${companionUsage.requestCount} + 1` },
            setWhere: sql`${companionUsage.requestCount} < ${DAILY_LIMIT}`,
          })
          .returning({ requestCount: companionUsage.requestCount });
    if (!usage) {
      return NextResponse.json({ error: usingPersonalKey ? "personal_limit" : "cherenkov_limit" }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // Every failure from here on is the provider's (or the network's), not the
  // student's, so it gives the counted request back.
  const fail = async (error: string, status: number) => {
    await refundRequest(user.id, usageDay, usingPersonalKey);
    return NextResponse.json({ error }, { status });
  };
  // Page context is resolved here, from published content, never taken from the
  // browser. Chat contents are never logged.
  const systemPrompt = buildSystemPrompt({ page: resolvePageContext(pageRef), index: listContentIndex() });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: normaliseConversation(messages).map(({ role, text }) => ({ role, parts: [{ text }] })),
          generationConfig: { maxOutputTokens: COMPANION_MAX_OUTPUT_TOKENS, temperature: 0.4 },
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
    const truncated = wasTruncated(candidate);

    // Save the exchange. A failure to save is a failure of the request: the
    // student would otherwise see a reply that is missing from their history.
    const lastUser = [...messages].reverse().find((message) => message.role === "user")!;
    try {
      const savedChatId = await saveExchange({ userId: user.id, chatId, userText: lastUser.text, reply });
      return NextResponse.json({ chatId: savedChatId, reply, truncated });
    } catch (error) {
      if (error instanceof ChatConflict) return fail(error.code, 409);
      return fail("unavailable", 503);
    }
  } catch {
    return fail(usingPersonalKey ? "personal_unavailable" : "provider_unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }
}
