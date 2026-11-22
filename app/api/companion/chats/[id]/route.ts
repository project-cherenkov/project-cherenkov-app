import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { companionChatMessages, companionChats } from "@/lib/db/schema";
import { isChatId } from "@/lib/companion-chat-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Someone else's chat id, and one that does not exist, both answer 404, so the
// response never confirms that another student's chat exists.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  if (!isChatId(id)) return NextResponse.json({ error: "chat_not_found" }, { status: 404 });
  try {
    const [chat] = await db
      .select({ id: companionChats.id, title: companionChats.title })
      .from(companionChats)
      .where(and(eq(companionChats.id, id), eq(companionChats.userId, user.id)))
      .limit(1);
    if (!chat) return NextResponse.json({ error: "chat_not_found" }, { status: 404 });
    const messages = await db
      .select({ role: companionChatMessages.role, text: companionChatMessages.body })
      .from(companionChatMessages)
      .where(eq(companionChatMessages.chatId, chat.id))
      .orderBy(asc(companionChatMessages.position));
    return NextResponse.json({ id: chat.id, title: chat.title, messages });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  if (!isChatId(id)) return NextResponse.json({ error: "chat_not_found" }, { status: 404 });
  try {
    const deleted = await db
      .delete(companionChats)
      .where(and(eq(companionChats.id, id), eq(companionChats.userId, user.id)))
      .returning({ id: companionChats.id });
    if (deleted.length === 0) return NextResponse.json({ error: "chat_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
