import { describe, expect, it, vi } from "vitest";
import {
  scoreAnswers,
  computeTopicScore,
  submitQuizAttemptCore,
  type QuestionResponseRow,
  type QuizAttemptDeps,
  type QuizQuestionForScoring,
} from "./quiz-scoring";

const single = (id: string, correctChoiceIndex: number, choiceCount: number): QuizQuestionForScoring => ({
  id,
  content: { type: "single_choice", choices: Array.from({ length: choiceCount }, (_, i) => `c${i}`) },
  answerKey: { type: "single_choice", correctChoiceIndex },
  explanation: `why ${id}`,
});

const ANSWER_KEYS: QuizQuestionForScoring[] = [
  single("q1", 2, 4),
  single("q2", 0, 3),
  single("q3", 1, 4),
];

function makeFakeDeps(answerKeys: QuizQuestionForScoring[]) {
  const inserted: { userId: string; topicId: string; score: number }[] = [];
  const responses: QuestionResponseRow[] = [];
  const calls: string[] = [];
  const onAttemptRecorded = vi.fn(async () => {
    calls.push("onAttemptRecorded");
  });
  const deps: QuizAttemptDeps = {
    getQuestions: vi.fn().mockResolvedValue(answerKeys),
    insertAttempt: vi.fn(async (row) => {
      calls.push("insertAttempt");
      inserted.push(row);
      return `attempt-${inserted.length}`;
    }),
    insertResponses: vi.fn(async (rows) => {
      calls.push("insertResponses");
      responses.push(...rows);
    }),
    onAttemptRecorded,
  };
  return { deps, inserted, responses, calls, onAttemptRecorded };
}

// QUIZ-001 required test (spec §8): "submit a Server Action call with a
// forged high score / manipulated payload shape; assert the stored
// quiz_attempts.score is computed from correct_choice_index, ignoring any
// client-sent score field."
describe("submitQuizAttemptCore — forged score is ignored", () => {
  it("computes the score server-side even when the payload carries a forged score field", async () => {
    const { deps, inserted } = makeFakeDeps(ANSWER_KEYS);

    // All three answers are actually WRONG (correctChoiceIndex is 2, 0, 1 —
    // these select 0, 1, 2). A real attacker doesn't go through this
    // function's TypeScript type, so this simulates the actual attack shape:
    // an arbitrary object that also claims a perfect score.
    const forgedInput = {
      topicId: "topic-1",
      answers: [
        { questionId: "q1", selectedChoiceIndex: 0 },
        { questionId: "q2", selectedChoiceIndex: 1 },
        { questionId: "q3", selectedChoiceIndex: 2 },
      ],
      score: 1.0, // forged — not part of SubmitQuizAttemptInput's real shape
    } as unknown as Parameters<typeof submitQuizAttemptCore>[2];

    const result = await submitQuizAttemptCore(deps, "user-1", forgedInput);

    expect(result.score).toBe(0);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.score).toBe(0);
    expect(inserted[0]?.userId).toBe("user-1");
  });

  it("scores correctly when answers are actually correct", async () => {
    const { deps, inserted } = makeFakeDeps(ANSWER_KEYS);

    const result = await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [
        { questionId: "q1", selectedChoiceIndex: 2 },
        { questionId: "q2", selectedChoiceIndex: 0 },
        { questionId: "q3", selectedChoiceIndex: 3 }, // wrong
      ],
    });

    expect(result.score).toBeCloseTo(2 / 3);
    expect(inserted[0]?.score).toBeCloseTo(2 / 3);
  });

  it("calls onAttemptRecorded after a valid submission (PLANNER-002 completed_at sync hook)", async () => {
    const { deps, onAttemptRecorded } = makeFakeDeps(ANSWER_KEYS);

    await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [{ questionId: "q1", selectedChoiceIndex: 2 }],
    });

    expect(onAttemptRecorded).toHaveBeenCalledWith("user-1", "topic-1");
  });
});

// spec §6 partial-failure / validation requirements.
describe("scoreAnswers — validation and partial submissions", () => {
  it("rejects an answer with an unknown questionId", () => {
    const { scored, invalid } = scoreAnswers(ANSWER_KEYS, [
      { questionId: "does-not-exist", selectedChoiceIndex: 0 },
    ]);
    expect(scored).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it("rejects an out-of-range selectedChoiceIndex", () => {
    const { scored, invalid } = scoreAnswers(ANSWER_KEYS, [
      { questionId: "q1", selectedChoiceIndex: 99 },
      { questionId: "q1", selectedChoiceIndex: -1 },
    ]);
    expect(scored).toHaveLength(0);
    expect(invalid).toHaveLength(2);
  });

  it("scores only the answered questions — unanswered questions are never penalized", () => {
    // Only q1 and q2 answered; q3 was never attempted.
    const { scored } = scoreAnswers(ANSWER_KEYS, [
      { questionId: "q1", selectedChoiceIndex: 2 }, // correct
      { questionId: "q2", selectedChoiceIndex: 1 }, // wrong
    ]);
    expect(scored).toHaveLength(2);
    // Score is out of the 2 answered, not out of 3 total questions.
    expect(computeTopicScore(scored)).toBe(0.5);
  });

  it("rejects duplicate question IDs instead of counting them twice", () => {
    const { scored, invalid } = scoreAnswers(ANSWER_KEYS, [
      { questionId: "q1", selectedChoiceIndex: 2 },
      { questionId: "q1", selectedChoiceIndex: 2 },
      { questionId: "q3", selectedChoiceIndex: 2 },
    ]);
    expect(scored).toHaveLength(2);
    expect(invalid).toHaveLength(1);
    expect(computeTopicScore(scored)).toBe(0.5);
  });

  it("submitQuizAttemptCore records nothing when every answer is invalid", async () => {
    const { deps, inserted } = makeFakeDeps(ANSWER_KEYS);

    const result = await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [{ questionId: "unknown", selectedChoiceIndex: 0 }],
    });

    expect(result.scoredAnswers).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });
});

describe("submitQuizAttemptCore — partial submissions do not grant mastery", () => {
  it("stores the score against all topic questions", async () => {
    const { deps, inserted } = makeFakeDeps(ANSWER_KEYS);

    await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [{ questionId: "q1", selectedChoiceIndex: 2 }],
    });

    expect(inserted[0]?.score).toBeCloseTo(1 / ANSWER_KEYS.length);
  });
});

// Phase 3: every answered question is also recorded individually, so mastery
// can be estimated per topic instead of from one aggregate score.
describe("submitQuizAttemptCore — per-question responses", () => {
  it("records one response per answered question, tied to the new attempt id", async () => {
    const { deps, responses } = makeFakeDeps(ANSWER_KEYS);

    await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [
        { questionId: "q1", selectedChoiceIndex: 2 }, // correct
        { questionId: "q2", selectedChoiceIndex: 1 }, // wrong
        { questionId: "q3", selectedChoiceIndex: 1 }, // correct
      ],
    });

    expect(responses).toEqual([
      { attemptId: "attempt-1", questionId: "q1", correct: true, response: { type: "single_choice", choiceIndex: 2 }, selectedChoiceIndex: 2 },
      { attemptId: "attempt-1", questionId: "q2", correct: false, response: { type: "single_choice", choiceIndex: 1 }, selectedChoiceIndex: 1 },
      { attemptId: "attempt-1", questionId: "q3", correct: true, response: { type: "single_choice", choiceIndex: 1 }, selectedChoiceIndex: 1 },
    ]);
  });

  it("leaves no row for unanswered questions (not asked is not the same as wrong)", async () => {
    const { deps, responses } = makeFakeDeps(ANSWER_KEYS);

    await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [{ questionId: "q2", selectedChoiceIndex: 0 }],
    });

    expect(responses.map((r) => r.questionId)).toEqual(["q2"]);
  });

  it("leaves no row for rejected answers (unknown question, bad index, duplicate)", async () => {
    const { deps, responses } = makeFakeDeps(ANSWER_KEYS);

    await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [
        { questionId: "q1", selectedChoiceIndex: 2 },
        { questionId: "q1", selectedChoiceIndex: 0 }, // duplicate
        { questionId: "nope", selectedChoiceIndex: 0 }, // unknown
        { questionId: "q2", selectedChoiceIndex: 9 }, // out of range
      ],
    });

    expect(responses).toEqual([
      { attemptId: "attempt-1", questionId: "q1", correct: true, response: { type: "single_choice", choiceIndex: 2 }, selectedChoiceIndex: 2 },
    ]);
  });

  it("derives correctness from the server-side key, not from anything the client sent", async () => {
    const { deps, responses } = makeFakeDeps(ANSWER_KEYS);
    const forged = {
      topicId: "topic-1",
      answers: [{ questionId: "q1", selectedChoiceIndex: 0, correct: true }],
    } as unknown as Parameters<typeof submitQuizAttemptCore>[2];

    await submitQuizAttemptCore(deps, "user-1", forged);

    expect(responses[0]?.correct).toBe(false);
  });

  it("writes the attempt first, then its responses, then runs the completion hook", async () => {
    const { deps, calls } = makeFakeDeps(ANSWER_KEYS);

    await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [{ questionId: "q1", selectedChoiceIndex: 2 }],
    });

    expect(calls).toEqual(["insertAttempt", "insertResponses", "onAttemptRecorded"]);
  });

  it("writes neither an attempt nor responses when every answer is invalid", async () => {
    const { deps, responses, inserted } = makeFakeDeps(ANSWER_KEYS);

    await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [{ questionId: "unknown", selectedChoiceIndex: 0 }],
    });

    expect(inserted).toHaveLength(0);
    expect(responses).toHaveLength(0);
  });
});

// ---- the four question types, end to end through the real submission core ----

const MULTI: QuizQuestionForScoring = {
  id: "m1",
  content: { type: "multiple_select", choices: ["a", "b", "c", "d"] },
  answerKey: { type: "multiple_select", correctChoiceIndices: [0, 2] },
  explanation: "why m1",
};
const TF: QuizQuestionForScoring = {
  id: "t1",
  content: { type: "true_false_set", statements: ["s1", "s2", "s3"] },
  answerKey: { type: "true_false_set", truthValues: [true, false, true] },
  explanation: "why t1",
};
const NUM: QuizQuestionForScoring = {
  id: "n1",
  content: { type: "numeric_response", unit: "au" },
  answerKey: { type: "numeric_response", value: 2.35, tolerance: 0.01 },
  explanation: "why n1",
};
const MIXED = [single("q1", 2, 4), MULTI, TF, NUM];

describe("typed responses", () => {
  const answer = (questionId: string, response: unknown) => ({ questionId, response }) as never;

  it("scores each type from the server key; multiple-select is order-insensitive", () => {
    const { scored, invalid } = scoreAnswers(MIXED, [
      answer("q1", { type: "single_choice", choiceIndex: 2 }),
      answer("m1", { type: "multiple_select", choiceIndices: [2, 0] }),
      answer("t1", { type: "true_false_set", values: [true, false, true] }),
      answer("n1", { type: "numeric_response", value: 2.36 }),
    ]);
    expect(invalid).toEqual([]);
    expect(scored.map((s) => s.correct)).toEqual([true, true, true, true]);
  });

  it("marks each type wrong when it should be wrong (no partial credit)", () => {
    const { scored } = scoreAnswers(MIXED, [
      answer("q1", { type: "single_choice", choiceIndex: 0 }),
      answer("m1", { type: "multiple_select", choiceIndices: [0] }),
      answer("t1", { type: "true_false_set", values: [true, false, false] }),
      answer("n1", { type: "numeric_response", value: 2.3601 }),
    ]);
    expect(scored.map((s) => s.correct)).toEqual([false, false, false, false]);
  });

  it("rejects a response whose type is not the question's type (client cannot choose the scoring mode)", () => {
    const { scored, invalid } = scoreAnswers(MIXED, [
      answer("m1", { type: "single_choice", choiceIndex: 0 }),
      answer("t1", { type: "multiple_select", choiceIndices: [0, 2] }),
      answer("n1", { type: "true_false_set", values: [true, false, true] }),
      answer("q1", { type: "numeric_response", value: 2 }),
    ]);
    expect(scored).toEqual([]);
    expect(invalid).toHaveLength(4);
  });

  it.each([
    ["duplicate multi indices", "m1", { type: "multiple_select", choiceIndices: [0, 0] }],
    ["out-of-range multi index", "m1", { type: "multiple_select", choiceIndices: [0, 7] }],
    ["short true/false vector", "t1", { type: "true_false_set", values: [true, false] }],
    ["non-boolean true/false element", "t1", { type: "true_false_set", values: [true, "false", true] }],
    ["NaN", "n1", { type: "numeric_response", value: Number.NaN }],
    ["Infinity", "n1", { type: "numeric_response", value: Infinity }],
    ["string number", "n1", { type: "numeric_response", value: "2.35" }],
  ])("rejects %s", (_name, id, response) => {
    const { scored, invalid } = scoreAnswers(MIXED, [answer(id, response)]);
    expect(scored).toEqual([]);
    expect(invalid).toHaveLength(1);
  });

  it("still accepts the legacy single-choice payload shape", () => {
    const { scored } = scoreAnswers(MIXED, [{ questionId: "q1", selectedChoiceIndex: 2 }]);
    expect(scored).toEqual([{ questionId: "q1", correct: true, response: { type: "single_choice", choiceIndex: 2 } }]);
  });

  it("ignores a legacy selectedChoiceIndex sent for a non-single-choice question", () => {
    const { scored, invalid } = scoreAnswers(MIXED, [{ questionId: "m1", selectedChoiceIndex: 0 }]);
    expect(scored).toEqual([]);
    expect(invalid).toHaveLength(1);
  });

  it("stores the type-neutral response (single_choice also mirrors selected_choice_index) and reveals feedback only for answered questions", async () => {
    const { deps, responses, inserted } = makeFakeDeps(MIXED);
    const result = await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [
        answer("m1", { type: "multiple_select", choiceIndices: [2, 0] }),
        answer("t1", { type: "true_false_set", values: [false, false, true] }),
        answer("n1", { type: "numeric_response", value: 2.35 }),
      ],
    });
    expect(responses).toEqual([
      { attemptId: "attempt-1", questionId: "m1", correct: true, response: { type: "multiple_select", choiceIndices: [0, 2] }, selectedChoiceIndex: null },
      { attemptId: "attempt-1", questionId: "t1", correct: false, response: { type: "true_false_set", values: [false, false, true] }, selectedChoiceIndex: null },
      { attemptId: "attempt-1", questionId: "n1", correct: true, response: { type: "numeric_response", value: 2.35 }, selectedChoiceIndex: null },
    ]);
    // Unanswered q1 gets no row and no reveal, but stays in the denominator: 2 correct of 4.
    expect(inserted[0]?.score).toBe(2 / 4);
    expect(result.feedback.map((f) => f.questionId)).toEqual(["m1", "t1", "n1"]);
    expect(result.feedback[1]).toEqual({
      questionId: "t1",
      correct: false,
      correctAnswer: { type: "true_false_set", truthValues: [true, false, true] },
      explanation: "why t1",
    });
    expect(result.feedback[2]?.correctAnswer).toEqual({ type: "numeric_response", value: 2.35, tolerance: 0.01, unit: "au" });
  });

  it("ignores forged correctness, score and key fields on typed answers", async () => {
    const { deps, inserted, responses } = makeFakeDeps(MIXED);
    const forged = {
      topicId: "topic-1",
      score: 1,
      answers: [
        { questionId: "n1", response: { type: "numeric_response", value: 99 }, correct: true, answerKey: { value: 99, tolerance: 1000 }, tolerance: 1000 },
        { questionId: "t1", response: { type: "true_false_set", values: [false, true, false] }, correct: true, truthValues: [false, true, false] },
      ],
    } as unknown as Parameters<typeof submitQuizAttemptCore>[2];
    await submitQuizAttemptCore(deps, "user-1", forged);
    expect(inserted[0]?.score).toBe(0);
    expect(responses.map((r) => r.correct)).toEqual([false, false]);
  });

  it("never puts answer-key material into a response row", async () => {
    const { deps, responses } = makeFakeDeps(MIXED);
    await submitQuizAttemptCore(deps, "user-1", {
      topicId: "topic-1",
      answers: [answer("n1", { type: "numeric_response", value: 2.35, tolerance: 1000 })],
    });
    expect(responses[0]?.response).toEqual({ type: "numeric_response", value: 2.35 });
  });
});
