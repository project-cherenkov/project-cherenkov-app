import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { companionChatMessages, companionChats } from "@/lib/db/schema";
import { COMPANION_MAX_CHATS, COMPANION_MAX_CHAT_MESSAGES } from "@/lib/companion-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lists the signed-in student's saved chats (newest first) with the figures the
// meters show. Every query is filtered by the authenticated user's id.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const chats = await db
      .select({
        id: companionChats.id,
        title: companionChats.title,
        updatedAt: companionChats.updatedAt,
        messageCount: sql<number>`count(${companionChatMessages.id})::int`,
        characters: sql<number>`coalesce(sum(char_length(${companionChatMessages.body})), 0)::int`,
      })
      .from(companionChats)
      .leftJoin(companionChatMessages, eq(companionChatMessages.chatId, companionChats.id))
      .where(eq(companionChats.userId, user.id))
      .groupBy(companionChats.id)
      .orderBy(desc(companionChats.updatedAt));
    return NextResponse.json({
      chats: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt.toISOString(),
        messageCount: chat.messageCount,
      })),
      usage: {
        chats: chats.length,
        maxChats: COMPANION_MAX_CHATS,
        maxMessagesPerChat: COMPANION_MAX_CHAT_MESSAGES,
        messages: chats.reduce((sum, chat) => sum + chat.messageCount, 0),
        characters: chats.reduce((sum, chat) => sum + chat.characters, 0),
      },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

// "Delete all chats".
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    await db.delete(companionChats).where(eq(companionChats.userId, user.id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
