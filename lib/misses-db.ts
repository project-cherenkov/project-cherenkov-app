// Real Drizzle reads/writes for the misses-review page (R2). Server-only and
// deliberately NOT a "use server" module: every function takes a userId.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  questionRetries,
  quizAttempts,
  quizQuestionResponses,
  quizQuestions,
  topics,
} from "@/lib/db/schema";
import type { AnswerEvent, MissQuestion } from "@/lib/misses";
import type { RetryDeps } from "@/lib/misses-retry";

export async function loadMissData(
  userId: string,
): Promise<{ events: AnswerEvent[]; questions: MissQuestion[] }> {
  const missed = await db
    .selectDistinct({ questionId: quizQuestionResponses.questionId })
    .from(quizQuestionResponses)
    .innerJoin(quizAttempts, eq(quizQuestionResponses.attemptId, quizAttempts.id))
    .where(and(eq(quizAttempts.userId, userId), eq(quizQuestionResponses.correct, false)));
  const ids = missed.map((row) => row.questionId);
  if (ids.length === 0) return { events: [], questions: [] };

  const [questionRows, responseRows, retryRows] = await Promise.all([
    db
      .select({
        questionId: quizQuestions.id,
        prompt: quizQuestions.prompt,
        choices: quizQuestions.choices,
        correctChoiceIndex: quizQuestions.correctChoiceIndex,
        explanation: quizQuestions.explanation,
        difficulty: quizQuestions.difficulty,
        status: quizQuestions.status,
        subject: topics.subject,
        topicId: topics.id,
        syllabusTopicId: topics.syllabusTopicId,
      })
      .from(quizQuestions)
      .innerJoin(topics, eq(quizQuestions.topicId, topics.id))
      .where(and(
        inArray(quizQuestions.id, ids),
        eq(quizQuestions.status, "reviewed"),
        eq(quizQuestions.archived, false),
      )),
    db
      .select({
        questionId: quizQuestionResponses.questionId,
        correct: quizQuestionResponses.correct,
        selectedChoiceIndex: quizQuestionResponses.selectedChoiceIndex,
        at: quizQuestionResponses.answeredAt,
      })
      .from(quizQuestionResponses)
      .innerJoin(quizAttempts, eq(quizQuestionResponses.attemptId, quizAttempts.id))
      .where(and(eq(quizAttempts.userId, userId), inArray(quizQuestionResponses.questionId, ids))),
    db
      .select({
        questionId: questionRetries.questionId,
        correct: questionRetries.correct,
        selectedChoiceIndex: questionRetries.selectedChoiceIndex,
        at: questionRetries.answeredAt,
      })
      .from(questionRetries)
      .where(and(eq(questionRetries.userId, userId), inArray(questionRetries.questionId, ids))),
  ]);

  const events: AnswerEvent[] = [
    ...responseRows.map((r): AnswerEvent => ({ ...r, source: "quiz" })),
    ...retryRows.map((r): AnswerEvent => ({ ...r, source: "retry" })),
  ];
  return { events, questions: questionRows };
}

export const retryDeps: RetryDeps = {
  async getAnswerKey(questionId) {
    const [row] = await db
      .select({
        correctChoiceIndex: quizQuestions.correctChoiceIndex,
        choices: quizQuestions.choices,
        explanation: quizQuestions.explanation,
      })
      .from(quizQuestions)
      .where(and(
        eq(quizQuestions.id, questionId),
        eq(quizQuestions.status, "reviewed"),
        eq(quizQuestions.archived, false),
      ))
      .limit(1);
    if (!row) return null;
    return {
      correctChoiceIndex: row.correctChoiceIndex,
      choiceCount: row.choices.length,
      explanation: row.explanation,
    };
  },
  async hasMissed(userId, questionId) {
    const [row] = await db
      .select({ id: quizQuestionResponses.id })
      .from(quizQuestionResponses)
      .innerJoin(quizAttempts, eq(quizQuestionResponses.attemptId, quizAttempts.id))
      .where(
        and(
          eq(quizAttempts.userId, userId),
          eq(quizQuestionResponses.questionId, questionId),
          eq(quizQuestionResponses.correct, false),
        ),
      )
      .limit(1);
    return Boolean(row);
  },
  async insertRetry(row) {
    await db.insert(questionRetries).values(row);
  },
};
