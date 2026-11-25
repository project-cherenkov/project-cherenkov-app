// Retrying a missed question from the review page. DI'd like
// lib/quiz-scoring.ts so the rules are testable without a database.
//
// Rules, each one deliberate:
//  - correctness comes from the server-side answer key, never the client;
//  - the response must have the SERVER's question type and a valid shape for
//    it (see validateResponse); the client cannot pick the scoring mode;
//  - only a question the student has ALREADY got wrong can be retried, so this
//    endpoint cannot be used to read answers for questions they never
//    attempted (the correct answer is returned after a retry);
//  - a retry is stored in question_retries, which does NOT feed mastery or
//    plan completion (see the comment on that table).
import {
  gradeResponse,
  revealAnswer,
  validateResponse,
  type RevealedAnswer,
  type ServerQuestion,
  type SubmittedResponse,
} from "./quiz-types";

export type RetryQuestion = ServerQuestion & { explanation: string | null };

export interface RetryDeps {
  getQuestion: (questionId: string) => Promise<RetryQuestion | null>;
  hasMissed: (userId: string, questionId: string) => Promise<boolean>;
  insertRetry: (row: {
    userId: string;
    questionId: string;
    correct: boolean;
    response: SubmittedResponse;
    // Legacy single-choice mirror; null for the other types.
    selectedChoiceIndex: number | null;
  }) => Promise<void>;
}

export interface RetryInput {
  questionId: string;
  response?: unknown;
  /** @deprecated single-choice only; use `response`. */
  selectedChoiceIndex?: unknown;
}

export type RetryResult =
  | { ok: true; correct: boolean; correctAnswer: RevealedAnswer; explanation: string | null }
  | { ok: false; reason: "invalid" | "unavailable" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function retryMissedQuestionCore(
  deps: RetryDeps,
  userId: string,
  input: RetryInput,
): Promise<RetryResult> {
  if (typeof input?.questionId !== "string" || !UUID_RE.test(input.questionId)) {
    return { ok: false, reason: "invalid" };
  }
  const raw =
    input.response !== undefined
      ? input.response
      : Number.isInteger(input.selectedChoiceIndex)
        ? { type: "single_choice", choiceIndex: input.selectedChoiceIndex }
        : undefined;
  if (raw === undefined) return { ok: false, reason: "invalid" };

  const question = await deps.getQuestion(input.questionId);
  // Unknown question and "not one of your misses" look the same on purpose.
  if (!question || !(await deps.hasMissed(userId, input.questionId))) {
    return { ok: false, reason: "unavailable" };
  }
  const response = validateResponse(question.content, raw);
  if (!response) return { ok: false, reason: "invalid" };

  const correct = gradeResponse(question.answerKey, response);
  await deps.insertRetry({
    userId,
    questionId: input.questionId,
    correct,
    response,
    selectedChoiceIndex: response.type === "single_choice" ? response.choiceIndex : null,
  });
  return {
    ok: true,
    correct,
    correctAnswer: revealAnswer(question),
    explanation: question.explanation,
  };
}

// Revealing the answer to a missed question WITHOUT retrying it. The review
// page does not ship answers to the browser up front (that would make
// "try again" pointless); this returns one on request, and only for a
// question the student has already got wrong. It records nothing, so
// peeking never resolves a miss.
export type RevealResult =
  | { ok: true; correctAnswer: RevealedAnswer; explanation: string | null }
  | { ok: false; reason: "invalid" | "unavailable" };

export async function revealMissedAnswerCore(
  deps: Pick<RetryDeps, "getQuestion" | "hasMissed">,
  userId: string,
  questionId: string,
): Promise<RevealResult> {
  if (typeof questionId !== "string" || !UUID_RE.test(questionId)) {
    return { ok: false, reason: "invalid" };
  }
  const question = await deps.getQuestion(questionId);
  if (!question || !(await deps.hasMissed(userId, questionId))) {
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, correctAnswer: revealAnswer(question), explanation: question.explanation };
}
