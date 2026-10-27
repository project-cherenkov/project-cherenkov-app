import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { quizQuestions, topics } from "@/lib/db/schema";
import { parseQuizQuestionInput } from "@/lib/quiz-admin";

async function requireEditor() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Content editor authorization required." }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await requireEditor();
  if (denied) return denied;
  const [questions, topicsList] = await Promise.all([
    db.select({
      id: quizQuestions.id, key: quizQuestions.key, topicId: quizQuestions.topicId,
      subject: topics.subject, topicTitle: topics.title, chapter: topics.chapter, topicOrder: topics.order,
      prompt: quizQuestions.prompt, choices: quizQuestions.choices,
      correctChoiceIndex: quizQuestions.correctChoiceIndex, explanation: quizQuestions.explanation,
      difficulty: quizQuestions.difficulty, status: quizQuestions.status, archived: quizQuestions.archived,
    }).from(quizQuestions).innerJoin(topics, eq(quizQuestions.topicId, topics.id))
      .orderBy(asc(topics.subject), asc(topics.order), asc(quizQuestions.difficulty)),
    db.select({ id: topics.id, subject: topics.subject, title: topics.title, chapter: topics.chapter, order: topics.order })
      .from(topics).orderBy(asc(topics.subject), asc(topics.order)),
  ]);
  return NextResponse.json({ questions, topics: topicsList });
}

export async function POST(request: Request) {
  const denied = await requireEditor();
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = parseQuizQuestionInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const [topic] = await db.select({ id: topics.id }).from(topics)
    .where(and(eq(topics.id, parsed.value.topicId), eq(topics.subject, parsed.value.subject))).limit(1);
  if (!topic) return NextResponse.json({ error: "That topic does not belong to the selected subject." }, { status: 400 });
  const [created] = await db.insert(quizQuestions).values({
    key: `admin.${crypto.randomUUID()}`, topicId: topic.id, prompt: parsed.value.prompt,
    choices: parsed.value.choices, correctChoiceIndex: parsed.value.correctChoiceIndex,
    explanation: parsed.value.explanation, difficulty: parsed.value.difficulty, status: "draft",
  }).returning({ id: quizQuestions.id });
  return NextResponse.json({ id: created!.id }, { status: 201 });
}
