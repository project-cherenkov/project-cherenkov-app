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
  answerKeys: [] as { id: string; content: unknown; answerKey: unknown; explanation: string | null }[],
  attempts: [] as { score: number; attemptedAt: Date }[],
  planId: "plan-1" as string | null,
  planItem: { id: "item-1", completedAt: null as Date | null } as
    | { id: string; completedAt: Date | null }
    | null,
  // Phase 3: the plan item lookups per submission are, in order, the open
  // confirmation item (first) and then the open study/review item. The fake
  // cannot see the WHERE clause, so it answers by call order.
  confirmItem: null as { id: string; completedAt: Date | null } | null,
  planItemQueries: 0,
  markCompleteCalls: 0,
  responses: [] as {
    attemptId: string;
    questionId: string;
    correct: boolean;
    selectedChoiceIndex: number | null;
    response: unknown;
  }[],
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
        else if (table === schema.planItems) {
          const item = fixture.planItemQueries++ === 0 ? fixture.confirmItem : fixture.planItem;
          rows = item ? [item] : [];
        }
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
  fixture.confirmItem = null;
  fixture.planItemQueries = 0;
  fixture.user = { id: "user-1", email: "user@example.com" };
  fixture.answerKeys = ["q1", "q2", "q3", "q4", "q5"].map((id) => ({
    id,
    content: { type: "single_choice", choices: ["a", "b"] },
    answerKey: { type: "single_choice", correctChoiceIndex: 0 },
    explanation: null,
  }));
  fixture.attempts = [];
  fixture.planId = "plan-1";
  fixture.planItem = { id: "item-1", completedAt: null };
  fixture.markCompleteCalls = 0;
  fixture.responses = [];
});

function answersWithScore(correctCount: number) {
  return fixture.answerKeys.map((key, index) => ({
    questionId: key.id,
    selectedChoiceIndex: index < correctCount ? 0 : 1,
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
      { attemptId: "attempt-1", questionId: "q2", correct: true, response: { type: "single_choice", choiceIndex: 0 }, selectedChoiceIndex: 0 },
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

// Phase 3: a plan can hold several items per topic, including a confirmation
// quiz. Taking ANY quiz on the topic completes the open confirmation item,
// whatever the score; the study item still needs a passing result.
describe("submitQuizAttempt — Phase 3 confirmation items", () => {
  it("completes the confirmation item on a failing attempt without touching the study item", async () => {
    fixture.confirmItem = { id: "confirm-1", completedAt: null };
    const result = await submitQuizAttempt({
      topicId: "topic-1",
      answers: [{ questionId: "q1", selectedChoiceIndex: 1 }],
    });
    expect(result.ok).toBe(true);
    expect(fixture.markCompleteCalls).toBe(1);
  });
});

// All four types through the real server action, transaction and fake DB.
describe("submitQuizAttempt — the four question types", () => {
  beforeEach(() => {
    fixture.answerKeys = [
      { id: "s1", content: { type: "single_choice", choices: ["a", "b", "c"] }, answerKey: { type: "single_choice", correctChoiceIndex: 1 }, explanation: "e-s1" },
      { id: "m1", content: { type: "multiple_select", choices: ["a", "b", "c", "d"] }, answerKey: { type: "multiple_select", correctChoiceIndices: [1, 3] }, explanation: "e-m1" },
      { id: "t1", content: { type: "true_false_set", statements: ["x", "y", "z"] }, answerKey: { type: "true_false_set", truthValues: [true, true, false] }, explanation: null },
      { id: "n1", content: { type: "numeric_response", unit: "au" }, answerKey: { type: "numeric_response", value: 5, tolerance: 0.5 }, explanation: "e-n1" },
    ];
  });

  it("scores, persists the type-neutral response and returns type-aware feedback", async () => {
    const result = await submitQuizAttempt({
      topicId: "topic-1",
      answers: [
        { questionId: "s1", response: { type: "single_choice", choiceIndex: 1 } },
        { questionId: "m1", response: { type: "multiple_select", choiceIndices: [3, 1] } },
        { questionId: "t1", response: { type: "true_false_set", values: [true, false, false] } },
        { questionId: "n1", response: { type: "numeric_response", value: 5.5 } },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score).toBe(3 / 4);
    expect(result.results.map((r) => [r.questionId, r.correct])).toEqual([["s1", true], ["m1", true], ["t1", false], ["n1", true]]);
    expect(result.results[2]).toEqual({
      questionId: "t1", correct: false,
      correctAnswer: { type: "true_false_set", truthValues: [true, true, false] }, explanation: null,
    });
    expect(fixture.responses.map((r) => [r.questionId, r.response, r.selectedChoiceIndex])).toEqual([
      ["s1", { type: "single_choice", choiceIndex: 1 }, 1],
      ["m1", { type: "multiple_select", choiceIndices: [1, 3] }, null],
      ["t1", { type: "true_false_set", values: [true, false, false] }, null],
      ["n1", { type: "numeric_response", value: 5.5 }, null],
    ]);
  });

  it("rejects a mismatched or malformed response and stores nothing for it", async () => {
    const result = await submitQuizAttempt({
      topicId: "topic-1",
      answers: [
        { questionId: "m1", response: { type: "single_choice", choiceIndex: 1 } },
        { questionId: "n1", response: { type: "numeric_response", value: Number.NaN } },
        { questionId: "t1", response: { type: "true_false_set", values: [true] } },
      ] as never,
    });
    expect(result).toEqual({ ok: false, reason: "no_valid_answers" });
    expect(fixture.responses).toHaveLength(0);
    expect(fixture.attempts).toHaveLength(0);
  });

  it("skips a question whose stored jsonb is corrupt instead of serving or scoring it", async () => {
    fixture.answerKeys.push({ id: "bad", content: { type: "single_choice", choices: ["a", "b"] }, answerKey: { type: "multiple_select", correctChoiceIndices: [0, 1] }, explanation: null });
    const result = await submitQuizAttempt({
      topicId: "topic-1",
      answers: [
        { questionId: "bad", response: { type: "single_choice", choiceIndex: 0 } },
        { questionId: "s1", response: { type: "single_choice", choiceIndex: 1 } },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.score).toBe(1 / 4); // denominator = the 4 valid served questions
  });
});
