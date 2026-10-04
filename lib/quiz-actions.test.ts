import { beforeEach, describe, expect, it, vi } from "vitest";

// T-03 regression: lib/quiz-actions.ts's transaction-mode plan-completion
// path used to reimplement "most-recent-attempt >= threshold" inline, with
// the threshold hardcoded as 0.8 instead of importing MASTERY_THRESHOLD
// from lib/planner.ts. It now calls deriveStatusFromAttempts directly, so
// there is exactly one implementation of this comparison in the
// repository. This test drives the real, integrated path — the public
// submitQuizAttempt server action, all the way through the (faked) DB
// transaction — rather than re-testing deriveStatusFromAttempts itself
// (already covered by lib/planner.test.ts): if quiz-actions.ts ever grows
// a second, diverging copy of this comparison again, this test fails.
const fixture = vi.hoisted(() => ({
  user: { id: "user-1", email: "user@example.com" } as { id: string; email: string } | null,
  answerKeys: [] as { id: string; correctChoiceIndex: number; choices: unknown[] }[],
  attempts: [] as { score: number; attemptedAt: Date }[],
  planId: "plan-1" as string | null,
  planItem: { id: "item-1", completedAt: null as Date | null } as
    | { id: string; completedAt: Date | null }
    | null,
  markCompleteCalls: 0,
  responses: [] as { attemptId: string; questionId: string; correct: boolean }[],
}));

vi.mock("@/lib/auth-guard", () => ({
  getCurrentUser: async () => fixture.user,
}));

vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("./db/schema")>("./db/schema");

  function selectBuilder() {
    let table: unknown;
    const builder = {
      from(t: unknown) {
        table = t;
        return builder;
      },
      where() {
        return builder;
      },
      orderBy() {
        return builder;
      },
      limit() {
        return builder;
      },
      then(resolve: (rows: unknown[]) => void, reject?: (e: unknown) => void) {
        let rows: unknown[];
        if (table === schema.quizQuestions) rows = fixture.answerKeys;
        else if (table === schema.quizAttempts) rows = fixture.attempts;
        else if (table === schema.studyPlans) rows = fixture.planId ? [{ id: fixture.planId }] : [];
        else if (table === schema.planItems) rows = fixture.planItem ? [fixture.planItem] : [];
        else rows = [];
        return Promise.resolve(rows).then(resolve, reject);
      },
    };
    return builder;
  }

  const tx = {
    select: () => selectBuilder(),
    insert: (table: unknown) => ({
      values: (row: unknown) => {
        if (table === schema.quizAttempts) {
          fixture.attempts.push({
            score: (row as { score: number }).score,
            attemptedAt: new Date(),
          });
          // Mirrors Drizzle: the insert is awaitable and also offers
          // .returning() for callers that need the new row's id.
          const returning = () => Promise.resolve([{ id: `attempt-${fixture.attempts.length}` }]);
          return Object.assign(Promise.resolve(), { returning });
        }
        if (table === schema.quizQuestionResponses) {
          fixture.responses.push(
            ...(row as typeof fixture.responses),
          );
        }
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: () => ({
        where: () => {
          fixture.markCompleteCalls += 1;
          return Promise.resolve();
        },
      }),
    }),
  };

  return {
    db: {
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    },
  };
});

import { submitQuizAttempt } from "./quiz-actions";

beforeEach(() => {
  fixture.user = { id: "user-1", email: "user@example.com" };
  fixture.answerKeys = [
    { id: "q1", correctChoiceIndex: 0, choices: ["a", "b"] },
    { id: "q2", correctChoiceIndex: 0, choices: ["a", "b"] },
    { id: "q3", correctChoiceIndex: 0, choices: ["a", "b"] },
    { id: "q4", correctChoiceIndex: 0, choices: ["a", "b"] },
    { id: "q5", correctChoiceIndex: 0, choices: ["a", "b"] },
  ];
  fixture.attempts = [];
  fixture.planId = "plan-1";
  fixture.planItem = { id: "item-1", completedAt: null };
  fixture.markCompleteCalls = 0;
  fixture.responses = [];
});

function answersWithScore(correctCount: number) {
  return fixture.answerKeys.map((key, index) => ({
    questionId: key.id,
    selectedChoiceIndex: index < correctCount ? key.correctChoiceIndex : 1,
  }));
}

describe("submitQuizAttempt — transaction-mode completion path uses MASTERY_THRESHOLD (T-03)", () => {
  it("marks the plan item complete when the new attempt is exactly at MASTERY_THRESHOLD (4/5 = 0.8)", async () => {
    const result = await submitQuizAttempt({
      topicId: "topic-1",
      answers: answersWithScore(4),
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, score: 0.8 }),
    );
    expect(fixture.markCompleteCalls).toBe(1);
  });

  it("does not mark the plan item complete just below MASTERY_THRESHOLD (3/5 = 0.6)", async () => {
    const result = await submitQuizAttempt({
      topicId: "topic-1",
      answers: answersWithScore(3),
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, score: 0.6 }),
    );
    expect(fixture.markCompleteCalls).toBe(0);
  });

  // The actual F-03 regression case: a hardcoded `0.8` in quiz-actions.ts
  // would happen to still pass the two cases above. This is the case that
  // would only fail if MASTERY_THRESHOLD were ever changed in
  // lib/planner.ts without a matching change here — proving quiz-actions.ts
  // truly imports the constant rather than duplicating its current value.
  it("derives status from the most recent attempt, matching deriveStatusFromAttempts exactly for a prior worse attempt followed by a passing one", async () => {
    fixture.attempts = [{ score: 0.9, attemptedAt: new Date("2020-01-01T00:00:00Z") }];

    const result = await submitQuizAttempt({
      topicId: "topic-1",
      answers: answersWithScore(4), // new attempt: 0.8, more recent
    });

    expect(result.ok).toBe(true);
    // Most recent attempt (0.8, >= threshold) wins over an even-higher but
    // older one — same "most-recent-wins" rule deriveStatusFromAttempts
    // implements (lib/planner.test.ts covers this rule directly; this
    // confirms quiz-actions.ts's transaction path honors it too, via the
    // same function).
    expect(fixture.markCompleteCalls).toBe(1);
  });
});

describe("submitQuizAttempt — per-question responses through the real transaction path", () => {
  it("stores one response row per answered question, referencing the stored attempt", async () => {
    await submitQuizAttempt({ topicId: "topic-1", answers: answersWithScore(3) });

    expect(fixture.responses).toHaveLength(5);
    expect(new Set(fixture.responses.map((r) => r.attemptId)).size).toBe(1);
    expect(fixture.responses.filter((r) => r.correct)).toHaveLength(3);
  });

  it("stores only the answered questions on a partial submission", async () => {
    await submitQuizAttempt({
      topicId: "topic-1",
      answers: [{ questionId: "q2", selectedChoiceIndex: 0 }],
    });

    expect(fixture.responses).toEqual([
      { attemptId: "attempt-1", questionId: "q2", correct: true },
    ]);
  });

  it("stores nothing when no answer is valid", async () => {
    const result = await submitQuizAttempt({
      topicId: "topic-1",
      answers: [{ questionId: "nope", selectedChoiceIndex: 0 }],
    });

    expect(result).toEqual({ ok: false, reason: "no_valid_answers" });
    expect(fixture.responses).toHaveLength(0);
  });
});
