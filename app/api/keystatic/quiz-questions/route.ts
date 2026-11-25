import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isVerifiedAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { quizQuestions, topics } from "@/lib/db/schema";
import { quizQuestionSource } from "@/lib/quiz-admin";

async function requireEditor() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isVerifiedAdmin(user)) return NextResponse.json({ error: "Content editor authorization required." }, { status: 403 });
  return null;
}

// Read-only list, for any of the four question types. Editors-only (verified
// admins): the answer key is included here on purpose so the page can show
// what is being served, and is never sent by any student-facing route (see
// lib/quiz.ts). Questions are no longer created here: author them in
// Keystatic (Quiz: <subject>) and sync with `pnpm db:seed:quiz`.
export async function GET() {
  const denied = await requireEditor();
  if (denied) return denied;
  const [questions, topicsList] = await Promise.all([
    db.select({
      id: quizQuestions.id, key: quizQuestions.key, topicId: quizQuestions.topicId,
      subject: topics.subject, topicTitle: topics.title, chapter: topics.chapter, topicOrder: topics.order,
      prompt: quizQuestions.prompt, questionType: quizQuestions.questionType,
      content: quizQuestions.content, answerKey: quizQuestions.answerKey,
      explanation: quizQuestions.explanation,
      difficulty: quizQuestions.difficulty, status: quizQuestions.status, archived: quizQuestions.archived,
    }).from(quizQuestions).innerJoin(topics, eq(quizQuestions.topicId, topics.id))
      .orderBy(asc(topics.subject), asc(topics.order), asc(quizQuestions.difficulty)),
    db.select({ id: topics.id, subject: topics.subject, title: topics.title, chapter: topics.chapter, order: topics.order })
      .from(topics).orderBy(asc(topics.subject), asc(topics.order)),
  ]);
  return NextResponse.json({
    questions: questions.map((question) => ({ ...question, source: quizQuestionSource(question.key) })),
    topics: topicsList,
  });
}
