import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { quizQuestions, topics } from "@/lib/db/schema";
import { parseQuizQuestionPatch } from "@/lib/quiz-admin";

async function authorized() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Content editor authorization required." }, { status: 403 });
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorized();
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = parseQuizQuestionPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  const [topic] = await db.select({ id: topics.id }).from(topics)
    .where(and(eq(topics.id, parsed.value.topicId), eq(topics.subject, parsed.value.subject))).limit(1);
  if (!topic) return NextResponse.json({ error: "That topic does not belong to the selected subject." }, { status: 400 });
  const updated = await db.update(quizQuestions).set({
    topicId: topic.id, prompt: parsed.value.prompt, choices: parsed.value.choices,
    correctChoiceIndex: parsed.value.correctChoiceIndex, explanation: parsed.value.explanation,
    difficulty: parsed.value.difficulty, status: parsed.value.status, archived: parsed.value.archived,
  }).where(eq(quizQuestions.id, id)).returning({ id: quizQuestions.id });
  if (updated.length === 0) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
