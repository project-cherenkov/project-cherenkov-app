"use client";

import { useCallback, useEffect, useState } from "react";

export type ChatSummary = { id: string; title: string; updatedAt: string; messageCount: number };
export type ChatUsage = { chats: number; maxChats: number; maxMessagesPerChat: number; messages: number; characters: number };
export type ChatListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; chats: ChatSummary[]; usage: ChatUsage };

function isSummary(value: unknown): value is ChatSummary {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.title === "string" && typeof v.updatedAt === "string" && typeof v.messageCount === "number";
}

/** Loads the signed-in student's saved chats and the figures for the meters. */
export function useChatList(enabled: boolean) {
  const [state, setState] = useState<ChatListState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/companion/chats", { cache: "no-store" });
      if (!response.ok) throw new Error("list failed");
      const data = (await response.json()) as { chats?: unknown; usage?: ChatUsage };
      if (!Array.isArray(data.chats) || !data.usage) throw new Error("bad list");
      setState({ status: "ready", chats: data.chats.filter(isSummary), usage: data.usage });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { state, refresh };
}
