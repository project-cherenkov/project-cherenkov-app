import { describe, expect, it, vi } from "vitest";

import { retryMissedQuestionCore, revealMissedAnswerCore, type RetryDeps } from "./misses-retry";

const QID = "11111111-1111-4111-8111-111111111111";

function makeDeps(over: Partial<RetryDeps> = {}) {
  const inserted: Parameters<RetryDeps["insertRetry"]>[0][] = [];
  const deps: RetryDeps = {
    getAnswerKey: vi.fn().mockResolvedValue({
      correctChoiceIndex: 2,
      choiceCount: 4,
      explanation: "because",
    }),
    hasMissed: vi.fn().mockResolvedValue(true),
    insertRetry: vi.fn(async (row) => {
      inserted.push(row);
    }),
    ...over,
  };
  return { deps, inserted };
}

describe("retryMissedQuestionCore", () => {
  it("scores against the server key and stores the retry", async () => {
    const { deps, inserted } = makeDeps();
    const wrong = await retryMissedQuestionCore(deps, "u1", { questionId: QID, selectedChoiceIndex: 0 });
    expect(wrong).toEqual({ ok: true, correct: false, correctChoiceIndex: 2, explanation: "because" });
    const right = await retryMissedQuestionCore(deps, "u1", { questionId: QID, selectedChoiceIndex: 2 });
    expect(right).toMatchObject({ ok: true, correct: true });
    expect(inserted).toEqual([
      { userId: "u1", questionId: QID, correct: false, selectedChoiceIndex: 0 },
      { userId: "u1", questionId: QID, correct: true, selectedChoiceIndex: 2 },
    ]);
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
    const { deps } = makeDeps({ getAnswerKey: vi.fn().mockResolvedValue(null) });
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
    ]) {
      expect(await retryMissedQuestionCore(deps, "u1", input)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(inserted).toHaveLength(0);
  });
});

describe("revealMissedAnswerCore", () => {
  it("reveals the key for a missed question and records nothing", async () => {
    const { deps, inserted } = makeDeps();
    expect(await revealMissedAnswerCore(deps, "u1", QID)).toEqual({
      ok: true,
      correctChoiceIndex: 2,
      explanation: "because",
    });
    expect(inserted).toHaveLength(0);
  });

  it("refuses a question that is not one of the student's misses", async () => {
    const { deps } = makeDeps({ hasMissed: vi.fn().mockResolvedValue(false) });
    expect(await revealMissedAnswerCore(deps, "u1", QID)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("rejects a malformed id before touching the database", async () => {
    const { deps } = makeDeps();
    expect(await revealMissedAnswerCore(deps, "u1", "nope")).toEqual({ ok: false, reason: "invalid" });
    expect(deps.getAnswerKey).not.toHaveBeenCalled();
  });
});
