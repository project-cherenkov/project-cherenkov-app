import { describe, expect, it, vi } from "vitest";

import { retryMissedQuestionCore, revealMissedAnswerCore, type RetryDeps, type RetryQuestion } from "./misses-retry";

const QID = "11111111-1111-4111-8111-111111111111";

const SINGLE: RetryQuestion = {
  id: QID,
  content: { type: "single_choice", choices: ["a", "b", "c", "d"] },
  answerKey: { type: "single_choice", correctChoiceIndex: 2 },
  explanation: "because",
};
const MULTI: RetryQuestion = {
  id: QID,
  content: { type: "multiple_select", choices: ["a", "b", "c", "d"] },
  answerKey: { type: "multiple_select", correctChoiceIndices: [0, 2] },
  explanation: "because",
};
const TF: RetryQuestion = {
  id: QID,
  content: { type: "true_false_set", statements: ["x", "y", "z"] },
  answerKey: { type: "true_false_set", truthValues: [true, false, true] },
  explanation: null,
};
const NUM: RetryQuestion = {
  id: QID,
  content: { type: "numeric_response", unit: "au" },
  answerKey: { type: "numeric_response", value: 2.35, tolerance: 0.01 },
  explanation: "n",
};

function makeDeps(over: Partial<RetryDeps> = {}, question: RetryQuestion = SINGLE) {
  const inserted: Parameters<RetryDeps["insertRetry"]>[0][] = [];
  const deps: RetryDeps = {
    getQuestion: vi.fn().mockResolvedValue(question),
    hasMissed: vi.fn().mockResolvedValue(true),
    insertRetry: vi.fn(async (row) => {
      inserted.push(row);
    }),
    ...over,
  };
  return { deps, inserted };
}

describe("retryMissedQuestionCore", () => {
  it("scores against the server key and stores the retry (legacy single-choice payload)", async () => {
    const { deps, inserted } = makeDeps();
    const wrong = await retryMissedQuestionCore(deps, "u1", { questionId: QID, selectedChoiceIndex: 0 });
    expect(wrong).toEqual({
      ok: true, correct: false, correctAnswer: { type: "single_choice", correctChoiceIndex: 2 }, explanation: "because",
    });
    const right = await retryMissedQuestionCore(deps, "u1", { questionId: QID, response: { type: "single_choice", choiceIndex: 2 } });
    expect(right).toMatchObject({ ok: true, correct: true });
    expect(inserted).toEqual([
      { userId: "u1", questionId: QID, correct: false, response: { type: "single_choice", choiceIndex: 0 }, selectedChoiceIndex: 0 },
      { userId: "u1", questionId: QID, correct: true, response: { type: "single_choice", choiceIndex: 2 }, selectedChoiceIndex: 2 },
    ]);
  });

  it("retries a multiple-select question (set match) and stores the response without the legacy column", async () => {
    const { deps, inserted } = makeDeps({}, MULTI);
    const ok = await retryMissedQuestionCore(deps, "u1", { questionId: QID, response: { type: "multiple_select", choiceIndices: [2, 0] } });
    expect(ok).toMatchObject({ ok: true, correct: true, correctAnswer: { type: "multiple_select", correctChoiceIndices: [0, 2] } });
    const no = await retryMissedQuestionCore(deps, "u1", { questionId: QID, response: { type: "multiple_select", choiceIndices: [0] } });
    expect(no).toMatchObject({ ok: true, correct: false });
    expect(inserted[0]).toEqual({
      userId: "u1", questionId: QID, correct: true, response: { type: "multiple_select", choiceIndices: [0, 2] }, selectedChoiceIndex: null,
    });
  });

  it("retries a true/false set and a numeric response", async () => {
    const tf = makeDeps({}, TF);
    expect(await retryMissedQuestionCore(tf.deps, "u1", { questionId: QID, response: { type: "true_false_set", values: [true, false, true] } }))
      .toMatchObject({ ok: true, correct: true });
    expect(await retryMissedQuestionCore(tf.deps, "u1", { questionId: QID, response: { type: "true_false_set", values: [true, true, true] } }))
      .toMatchObject({ ok: true, correct: false });
    const num = makeDeps({}, NUM);
    expect(await retryMissedQuestionCore(num.deps, "u1", { questionId: QID, response: { type: "numeric_response", value: 2.36 } }))
      .toMatchObject({ ok: true, correct: true, correctAnswer: { type: "numeric_response", value: 2.35, tolerance: 0.01, unit: "au" } });
    expect(await retryMissedQuestionCore(num.deps, "u1", { questionId: QID, response: { type: "numeric_response", value: 2.4 } }))
      .toMatchObject({ ok: true, correct: false });
    expect(num.inserted[0]).toMatchObject({ response: { type: "numeric_response", value: 2.36 }, selectedChoiceIndex: null });
  });

  it("rejects a response of the wrong type or shape for the server's question type", async () => {
    const { deps, inserted } = makeDeps({}, MULTI);
    for (const response of [
      { type: "single_choice", choiceIndex: 0 },
      { type: "multiple_select", choiceIndices: [0, 0] },
      { type: "multiple_select", choiceIndices: [9] },
      { type: "multiple_select", choiceIndices: [] },
    ]) {
      expect(await retryMissedQuestionCore(deps, "u1", { questionId: QID, response })).toEqual({ ok: false, reason: "invalid" });
    }
    const num = makeDeps({}, NUM);
    for (const value of [Number.NaN, Infinity, "2.35"]) {
      expect(await retryMissedQuestionCore(num.deps, "u1", { questionId: QID, response: { type: "numeric_response", value } })).toEqual({ ok: false, reason: "invalid" });
    }
    expect(inserted).toHaveLength(0);
    expect(num.inserted).toHaveLength(0);
  });

  it("ignores a client-supplied 'correct' flag", async () => {
    const { deps } = makeDeps();
    const forged = { questionId: QID, selectedChoiceIndex: 0, correct: true } as never;
    const result = await retryMissedQuestionCore(deps, "u1", forged);
    expect(result).toMatchObject({ ok: true, correct: false });
  });

  it("refuses a question the student never missed, without revealing the answer", async () => {
    const { deps, inserted } = makeDeps({ hasMissed: vi.fn().mockResolvedValue(false) });
    const result = await retryMissedQuestionCore(deps, "u1", { questionId: QID, selectedChoiceIndex: 2 });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(inserted).toHaveLength(0);
  });

  it("answers an unknown question exactly like a question that is not theirs", async () => {
    const { deps } = makeDeps({ getQuestion: vi.fn().mockResolvedValue(null) });
    const result = await retryMissedQuestionCore(deps, "u1", { questionId: QID, selectedChoiceIndex: 0 });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("rejects malformed ids and out-of-range or non-integer choices", async () => {
    const { deps, inserted } = makeDeps();
    for (const input of [
      { questionId: "not-a-uuid", selectedChoiceIndex: 0 },
      { questionId: QID, selectedChoiceIndex: 4 },
      { questionId: QID, selectedChoiceIndex: -1 },
      { questionId: QID, selectedChoiceIndex: 1.5 },
      { questionId: QID, selectedChoiceIndex: Number.NaN },
      { questionId: QID },
    ]) {
      expect(await retryMissedQuestionCore(deps, "u1", input)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(inserted).toHaveLength(0);
  });
});

describe("revealMissedAnswerCore", () => {
  it("reveals the key for a missed question of any type and records nothing", async () => {
    for (const question of [SINGLE, MULTI, TF, NUM]) {
      const { deps, inserted } = makeDeps({}, question);
      const result = await revealMissedAnswerCore(deps, "u1", QID);
      expect(result).toMatchObject({ ok: true });
      expect(inserted).toHaveLength(0);
    }
    const num = await revealMissedAnswerCore(makeDeps({}, NUM).deps, "u1", QID);
    expect(num).toEqual({ ok: true, correctAnswer: { type: "numeric_response", value: 2.35, tolerance: 0.01, unit: "au" }, explanation: "n" });
  });

  it("refuses a question that is not one of the student's misses", async () => {
    const { deps } = makeDeps({ hasMissed: vi.fn().mockResolvedValue(false) });
    expect(await revealMissedAnswerCore(deps, "u1", QID)).toEqual({ ok: false, reason: "unavailable" });
    expect(await revealMissedAnswerCore(deps, "u1", "nope")).toEqual({ ok: false, reason: "invalid" });
  });
});
