import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizQuestions } from "@/lib/db/schema";

export interface PublicQuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
}

// QUIZ-001 constraint: quiz_questions.correct_choice_index must never be
// sent to the client before submission. This is the only place in the app
// that reads quiz_questions for display purposes, and it deliberately never
// selects that column — components/quiz/* only ever sees this shape.
export async function getQuizQuestionsForTopic(
  topicId: string,
): Promise<PublicQuizQuestion[]> {
  const rows = await db
    .select({
      id: quizQuestions.id,
      prompt: quizQuestions.prompt,
      choices: quizQuestions.choices,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.topicId, topicId));

  return rows;
}
