"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  quizQuestions,
  quizAttempts,
  quizQuestionResponses,
  studyPlans,
  planItems,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth-guard";
import { deriveStatusFromAttempts } from "@/lib/planner";
import {
  syncPlanItemCompletion,
  syncPlanItemCompletionCore,
  type PlanSyncDeps,
} from "@/lib/planner-sync";
import {
  submitQuizAttemptCore,
  type QuizAttemptDeps,
  type QuizAttemptTxDeps,
  type QuestionFeedback,
  type QuizQuestionForScoring,
  type SubmitQuizAttemptInput,
} from "@/lib/quiz-scoring";
import { toServerQuestion } from "@/lib/quiz-types";

export type SubmitQuizResult =
  | {
      ok: true;
      score: number;
      // One entry per ANSWERED question: correctness, the type-appropriate
      // correct answer and the explanation, revealed only after submission.
      results: QuestionFeedback[];
    }
  | { ok: false; reason: "unauthenticated" | "no_valid_answers" };

// The questions served for a topic (reviewed, not archived) WITH their answer
// keys. This is one of the only server-side reads of quiz_questions.answer_key
// (the other is the miss-review reveal in lib/misses-db.ts); it is never sent
// to the client. A row whose jsonb is malformed is skipped, never scored.
type Selector = Pick<typeof db, "select">;
async function selectServedQuestions(
  executor: Selector,
  topicId: string,
): Promise<QuizQuestionForScoring[]> {
  const rows = await executor
    .select({
      id: quizQuestions.id,
      content: quizQuestions.content,
      answerKey: quizQuestions.answerKey,
      explanation: quizQuestions.explanation,
    })
    .from(quizQuestions)
    .where(
      and(
        eq(quizQuestions.topicId, topicId),
        eq(quizQuestions.status, "reviewed"),
        eq(quizQuestions.archived, false),
      ),
    );
  const questions: QuizQuestionForScoring[] = [];
  for (const row of rows) {
    const question = toServerQuestion(row.id, row.content, row.answerKey);
    if (question) questions.push({ ...question, explanation: row.explanation });
  }
  return questions;
}

const realDeps: QuizAttemptDeps = {
  getQuestions: (topicId) => selectServedQuestions(db, topicId),
  async insertAttempt(row) {
    const [inserted] = await db
      .insert(quizAttempts)
      .values(row)
      .returning({ id: quizAttempts.id });
    return inserted!.id;
  },
  async insertResponses(rows) {
    if (rows.length === 0) return;
    await db.insert(quizQuestionResponses).values(rows);
  },
  // Decision #8: recomputing status and stamping plan_items.completed_at
  // happens right after the attempt is recorded, driven by lib/planner.ts's
  // derived status (via lib/planner-sync.ts) — never a client-controlled
  // flag.
  onAttemptRecorded: syncPlanItemCompletion,
  async transaction(callback) {
    return db.transaction(async (tx) => {
      const txDeps: QuizAttemptTxDeps = {
        getQuestions: (topicId) => selectServedQuestions(tx, topicId),
        async insertAttempt(row) {
          const [inserted] = await tx
            .insert(quizAttempts)
            .values(row)
            .returning({ id: quizAttempts.id });
          return inserted!.id;
        },
        async insertResponses(rows) {
          if (rows.length === 0) return;
          await tx.insert(quizQuestionResponses).values(rows);
        },
        onAttemptRecorded: async (userId, topicId) => {
          const txSyncDeps: PlanSyncDeps = {
            // F-03 fix: fetch attempts via `tx` (same query shape as
            // before) but derive status through lib/planner.ts's
            // deriveStatusFromAttempts — the single source of truth for
            // this comparison — instead of re-implementing it inline with
            // the mastery threshold hardcoded.
            async getStatus(userId, topicId) {
              const attempts = await tx
                .select({
                  score: quizAttempts.score,
                  attemptedAt: quizAttempts.attemptedAt,
                })
                .from(quizAttempts)
                .where(
                  and(
                    eq(quizAttempts.userId, userId),
                    eq(quizAttempts.topicId, topicId),
                  ),
                )
                .orderBy(quizAttempts.attemptedAt, quizAttempts.id);

              return deriveStatusFromAttempts(attempts);
            },
            async getUserPlanId(userId) {
              const [plan] = await tx
                .select({ id: studyPlans.id })
                .from(studyPlans)
                .where(eq(studyPlans.userId, userId))
                .limit(1);
              return plan?.id ?? null;
            },
            async getPlanItem(planId, topicId) {
              const [item] = await tx
                .select({ id: planItems.id, completedAt: planItems.completedAt })
                .from(planItems)
                .where(
                  and(
                    eq(planItems.planId, planId),
                    eq(planItems.topicId, topicId),
                    isNull(planItems.completedAt),
                    ne(planItems.kind, "confirm"),
                  ),
                )
                .orderBy(planItems.scheduledFor, planItems.position)
                .limit(1);
              return item ?? null;
            },
            async getOpenConfirmItem(planId, topicId) {
              const [item] = await tx
                .select({ id: planItems.id, completedAt: planItems.completedAt })
                .from(planItems)
                .where(
                  and(
                    eq(planItems.planId, planId),
                    eq(planItems.topicId, topicId),
                    isNull(planItems.completedAt),
                    eq(planItems.kind, "confirm"),
                  ),
                )
                .orderBy(planItems.scheduledFor, planItems.position)
                .limit(1);
              return item ?? null;
            },
            async markComplete(planItemId) {
              await tx
                .update(planItems)
                .set({ completedAt: new Date() })
                .where(eq(planItems.id, planItemId));
            },
          };

          await syncPlanItemCompletionCore(txSyncDeps, userId, topicId);
        },
      };

      return callback(txDeps);
    });
  },
};

// QUIZ-001. quiz_questions.answer_key is only ever fetched here,
// server-side, via selectServedQuestions — never sent to the client (see
// lib/quiz.ts, the read side used to render the quiz form). The score is
// always computed from that server-fetched key inside submitQuizAttemptCore
// (lib/quiz-scoring.ts); nothing in `input`'s type carries a score field at
// all, so there is nothing here for a forged client payload to influence
// (spec §5, §8, §9 HIGH risk).
//
// Defense-in-depth (spec §9): derives the user from the session
// server-side, never from the request — even though middleware.ts already
// blocks unauthenticated requests to /planner/**.
export async function submitQuizAttempt(
  input: SubmitQuizAttemptInput,
): Promise<SubmitQuizResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const { scoredAnswers, feedback, score, rejected } = await submitQuizAttemptCore(
    realDeps,
    user.id,
    input,
  );

  if (rejected.length > 0) {
    console.warn(
      `submitQuizAttempt: rejected ${rejected.length} invalid answer(s) ` +
        `(unknown question or invalid response for its type) for topic ${input.topicId}.`,
    );
  }

  if (scoredAnswers.length === 0) {
    return { ok: false, reason: "no_valid_answers" };
  }

  return { ok: true, score, results: feedback };
}
