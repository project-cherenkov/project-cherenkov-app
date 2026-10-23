// Retrying a missed question from the review page. DI'd like
// lib/quiz-scoring.ts so the rules are testable without a database.
//
// Rules, each one deliberate:
//  - correctness comes from the server-side answer key, never the client;
//  - only a question the student has ALREADY got wrong can be retried, so this
//    endpoint cannot be used to read answers for questions they never
//    attempted (the correct choice is returned after a retry);
//  - a retry is stored in question_retries, which does NOT feed mastery or
//    plan completion (see the comment on that table).

export interface RetryAnswerKey {
  correctChoiceIndex: number;
  choiceCount: number;
  explanation: string | null;
}

export interface RetryDeps {
  getAnswerKey: (questionId: string) => Promise<RetryAnswerKey | null>;
  hasMissed: (userId: string, questionId: string) => Promise<boolean>;
  insertRetry: (row: {
    userId: string;
    questionId: string;
    correct: boolean;
    selectedChoiceIndex: number;
  }) => Promise<void>;
}

export interface RetryInput {
  questionId: string;
  selectedChoiceIndex: number;
}

export type RetryResult =
  | { ok: true; correct: boolean; correctChoiceIndex: number; explanation: string | null }
  | { ok: false; reason: "invalid" | "unavailable" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function retryMissedQuestionCore(
  deps: RetryDeps,
  userId: string,
  input: RetryInput,
): Promise<RetryResult> {
  if (
    typeof input?.questionId !== "string" ||
    !UUID_RE.test(input.questionId) ||
    !Number.isInteger(input.selectedChoiceIndex)
  ) {
    return { ok: false, reason: "invalid" };
  }

  const key = await deps.getAnswerKey(input.questionId);
  // Unknown question and "not one of your misses" look the same on purpose.
  if (!key || !(await deps.hasMissed(userId, input.questionId))) {
    return { ok: false, reason: "unavailable" };
  }
  if (input.selectedChoiceIndex < 0 || input.selectedChoiceIndex >= key.choiceCount) {
    return { ok: false, reason: "invalid" };
  }

  const correct = input.selectedChoiceIndex === key.correctChoiceIndex;
  await deps.insertRetry({
    userId,
    questionId: input.questionId,
    correct,
    selectedChoiceIndex: input.selectedChoiceIndex,
  });
  return {
    ok: true,
    correct,
    correctChoiceIndex: key.correctChoiceIndex,
    explanation: key.explanation,
  };
}

// Revealing the answer to a missed question WITHOUT retrying it. The review
// page does not ship answers to the browser up front (that would make
// "try again" pointless); this returns one on request, and only for a
// question the student has already got wrong. It records nothing, so
// peeking never resolves a miss.
export type RevealResult =
  | { ok: true; correctChoiceIndex: number; explanation: string | null }
  | { ok: false; reason: "invalid" | "unavailable" };

export async function revealMissedAnswerCore(
  deps: Pick<RetryDeps, "getAnswerKey" | "hasMissed">,
  userId: string,
  questionId: string,
): Promise<RevealResult> {
  if (typeof questionId !== "string" || !UUID_RE.test(questionId)) {
    return { ok: false, reason: "invalid" };
  }
  const key = await deps.getAnswerKey(questionId);
  if (!key || !(await deps.hasMissed(userId, questionId))) {
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, correctChoiceIndex: key.correctChoiceIndex, explanation: key.explanation };
}
