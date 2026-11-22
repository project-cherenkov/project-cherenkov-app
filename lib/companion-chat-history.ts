// Pure helpers for saved chats, kept apart from the routes so they can be
// tested without a database.
import { COMPANION_CHAT_TITLE_MAX, COMPANION_MAX_CHATS, COMPANION_MAX_CHAT_MESSAGES } from "@/lib/companion-settings";

/** First user message, collapsed to one line and trimmed. No AI call. */
export function chatTitleFromMessage(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "\u2026";
  return flat.length > COMPANION_CHAT_TITLE_MAX ? `${flat.slice(0, COMPANION_CHAT_TITLE_MAX - 1).trimEnd()}\u2026` : flat;
}

export type ChatLimitError = "chat_limit" | "chat_full";

/**
 * Decides, before anything is counted or sent, whether a request may go ahead.
 * `chatId` is null for a new conversation. `chatCount` is how many chats the
 * account has saved, `messageCount` how many messages the open chat has.
 * Both limits are 409s with their own code so the UI can say what to do.
 */
export function checkChatLimits(options: { chatId: string | null; chatCount: number; messageCount: number }): ChatLimitError | null {
  if (options.chatId === null) return options.chatCount >= COMPANION_MAX_CHATS ? "chat_limit" : null;
  // A reply adds two messages (the student's and Neutrino's).
  return options.messageCount + 2 > COMPANION_MAX_CHAT_MESSAGES ? "chat_full" : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isChatId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function approximateKilobytes(characters: number): number {
  return Math.max(0, Math.round(characters / 1024));
}
