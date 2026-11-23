import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isVerifiedAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { quizQuestions } from "@/lib/db/schema";
import { parseQuizArchivePatch } from "@/lib/quiz-admin";

async function authorized() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isVerifiedAdmin(user)) return NextResponse.json({ error: "Content editor authorization required." }, { status: 403 });
  return null;
}

// The only edit left on this page: archive a question now, or restore it.
// Content is edited in Keystatic and synced from git (lib/quiz-bank/sync.ts).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorized();
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = parseQuizArchivePatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  const updated = await db.update(quizQuestions).set({ archived: parsed.value.archived })
    .where(eq(quizQuestions.id, id)).returning({ id: quizQuestions.id });
  if (updated.length === 0) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
