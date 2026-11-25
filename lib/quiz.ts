import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizQuestions } from "@/lib/db/schema";
import { parseQuestionContent, type QuestionContent } from "@/lib/quiz-types";

// What the browser may receive BEFORE submission: the question type, the
// prompt and the display content for that type (choices, statements, or the
// numeric unit). Never an answer key.
export interface PublicQuizQuestion {
  id: string;
  prompt: string;
  content: QuestionContent;
}

// QUIZ-001 constraint: quiz_questions.answer_key (correct indices, truth
// values, expected numeric value and tolerance) must never be sent to the
// client before submission. This is the only place in the app that reads
// quiz_questions for display purposes, and it deliberately never selects that
// column — components/quiz/* only ever sees this shape.
export async function getQuizQuestionsForTopic(
  topicId: string,
): Promise<PublicQuizQuestion[]> {
  const rows = await db
    .select({
      id: quizQuestions.id,
      prompt: quizQuestions.prompt,
      content: quizQuestions.content,
    })
    .from(quizQuestions)
    .where(
      and(
        eq(quizQuestions.topicId, topicId),
        eq(quizQuestions.status, "reviewed"),
        eq(quizQuestions.archived, false),
      ),
    );

  const questions: PublicQuizQuestion[] = [];
  for (const row of rows) {
    // A malformed content column is skipped, matching the scoring read.
    const content = parseQuestionContent(row.content);
    if (content) questions.push({ id: row.id, prompt: row.prompt, content });
  }
  return questions;
}
