import { describe, expect, it, vi } from "vitest";
import {
  scoreAnswers,
  computeTopicScore,
  submitQuizAttemptCore,
  type QuizAttemptDeps,
  type QuizQuestionAnswerKey,
} from "./quiz-scoring";

const ANSWER_KEYS: QuizQuestionAnswerKey[] = [
  { id: "q1", correctChoiceIndex: 2, choiceCount: 4 },
  { id: "q2", correctChoiceIndex: 0, choiceCount: 3 },
  { id: "q3", correctChoiceIndex: 1, choiceCount: 4 },
];

function makeFakeDeps(answerKeys: QuizQuestionAnswerKey[]) {
  const inserted: { userId: string; topicId: string; score: number }[] = [];
  const onAttemptRecorded = vi.fn().mockResolvedValue(undefined);
  const deps: QuizAttemptDeps = {
    getAnswerKeys: vi.fn().mockResolvedValue(answerKeys),
    insertAttempt: vi.fn(async (row) => {
      inserted.push(row);
    }),
    onAttemptRecorded,
  };
  return { deps, inserted, onAttemptRecorded };
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
