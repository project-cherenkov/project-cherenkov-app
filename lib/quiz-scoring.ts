// QUIZ-001. Pure scoring logic plus a dependency-injected orchestration
// function, kept separate from the "use server" action (lib/quiz-actions.ts)
// specifically so §8's forged-score test can exercise the real submission
// logic with fake in-memory deps — no live database, no mocking Drizzle's
// query builder.

import {
  gradeResponse,
  revealAnswer,
  validateResponse,
  type RevealedAnswer,
  type ServerQuestion,
  type SubmittedResponse,
} from "@/lib/quiz-types";

// A question as the scoring code receives it: public content plus the
// server-fetched answer key (and the explanation to show afterwards).
export type QuizQuestionForScoring = ServerQuestion & { explanation?: string | null };

// What the client sends per question. `response` is the type-tagged answer;
// `selectedChoiceIndex` is the pre-four-types single-choice shape, still
// accepted so a tab opened before a deploy keeps working. Nothing here carries
// correctness, a score, an answer key or a user id, so a forged payload has
// nothing to influence (spec §5, §8, §9 HIGH risk).
export interface SubmittedAnswer {
  questionId: string;
  response?: SubmittedResponse;
  /** @deprecated single-choice only; use `response`. */
  selectedChoiceIndex?: number;
}

export interface ScoredAnswer {
  questionId: string;
  correct: boolean;
  // The validated, normalised response that was graded (what history stores).
  response: SubmittedResponse;
}

// What the student sees per answered question after submission. Built from the
// server-side key; only ever produced for questions that were answered.
export interface QuestionFeedback {
  questionId: string;
  correct: boolean;
  correctAnswer: RevealedAnswer;
  explanation: string | null;
}

function normalizeSubmitted(answer: SubmittedAnswer): unknown {
  if (answer.response !== undefined) return answer.response;
  if (typeof answer.selectedChoiceIndex === "number") {
    return { type: "single_choice", choiceIndex: answer.selectedChoiceIndex };
  }
  return undefined;
}

// Never receives or trusts anything the client claims about correctness —
// only the server-fetched questions (content + answer key) and the client's
// raw response per question are used. The expected response shape comes from
// the SERVER's question type: an answer for an unknown questionId, a response
// whose type differs from the question's, an out-of-range or duplicated index,
// a wrong-length or non-boolean true/false vector, or a non-finite number is
// rejected outright (spec §6 validation) rather than silently scored as wrong.
export function scoreAnswers(
  questions: QuizQuestionForScoring[],
  submitted: SubmittedAnswer[],
): { scored: ScoredAnswer[]; invalid: SubmittedAnswer[] } {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const scored: ScoredAnswer[] = [];
  const invalid: SubmittedAnswer[] = [];
  const seenQuestionIds = new Set<string>();

  for (const answer of submitted) {
    if (!answer || typeof answer.questionId !== "string" || seenQuestionIds.has(answer.questionId)) {
      invalid.push(answer);
      continue;
    }
    seenQuestionIds.add(answer.questionId);
    const question = byId.get(answer.questionId);
    const response = question ? validateResponse(question.content, normalizeSubmitted(answer)) : null;
    if (!question || !response) {
      invalid.push(answer);
      continue;
    }
    scored.push({
      questionId: answer.questionId,
      correct: gradeResponse(question.answerKey, response),
      response,
    });
  }

  return { scored, invalid };
}

// CH-04 (architect audit round 1): this docstring previously claimed
// "unanswered questions are never penalized" (spec §6's original
// partial-failure rule), but that is NOT what production scoring actually
// does — `submitQuizAttemptCore` below intentionally divides by
// `answerKeys.length` (the full topic's question count), not by the number
// of questions actually answered, "because mastery must reflect the
// complete topic" (see the comment at that line). `computeTopicScore` is
// not called anywhere outside its own test — it is a fraction-of-ANSWERED-
// questions calculation, useful only as a distinct, clearly-labeled metric
// (e.g. in-dialog "how many of the ones you tried did you get right?"
// feedback) and must not be read as describing the persisted mastery score.
export function computeTopicScore(scored: ScoredAnswer[]): number {
  if (scored.length === 0) return 0;
  const correctCount = scored.filter((a) => a.correct).length;
  return correctCount / scored.length;
}

export interface SubmitQuizAttemptInput {
  topicId: string;
  answers: SubmittedAnswer[];
}

export interface QuestionResponseRow {
  attemptId: string;
  questionId: string;
  correct: boolean;
  // Type-neutral record of what the student submitted (already validated by
  // scoreAnswers). Lets the misses-review page show "your answer".
  response: SubmittedResponse;
  // Legacy single-choice mirror: set for single_choice answers only.
  selectedChoiceIndex: number | null;
}

export interface QuizAttemptTxDeps {
  // The topic's served questions (reviewed, not archived) with their answer
  // keys. Server-side only.
  getQuestions: (topicId: string) => Promise<QuizQuestionForScoring[]>;
  // Returns the new attempt's id so the per-question responses can reference it.
  insertAttempt: (row: {
    userId: string;
    topicId: string;
    score: number;
  }) => Promise<string>;
  // One row per ANSWERED question (quiz_question_responses). Called right
  // after insertAttempt, inside the same transaction when one is available,
  // so an attempt is never stored without its responses.
  insertResponses: (rows: QuestionResponseRow[]) => Promise<void>;
  onAttemptRecorded?: (userId: string, topicId: string) => Promise<void>;
}

export interface QuizAttemptDeps extends QuizAttemptTxDeps {
  transaction?: <T>(
    callback: (tx: QuizAttemptTxDeps) => Promise<T>,
  ) => Promise<T>;
}

export interface SubmitQuizAttemptResult {
  scoredAnswers: ScoredAnswer[];
  feedback: QuestionFeedback[];
  score: number;
  rejected: SubmittedAnswer[];
}

// The actual submission orchestration, DI'd so it's testable without a DB.
// `input` is typed narrowly (topicId + answers only) — there is no `score`
// field anywhere in this signature, so even a client that appends an extra
// `score` property to its request body has nothing here that reads it. This
// is what §8's forged-score test exercises directly.
export async function submitQuizAttemptCore(
  deps: QuizAttemptDeps,
  userId: string,
  input: SubmitQuizAttemptInput,
): Promise<SubmitQuizAttemptResult> {
  if (deps.transaction) {
    return deps.transaction(async (txDeps) =>
      submitQuizAttemptCore(
        { ...txDeps, transaction: undefined },
        userId,
        input,
      ),
    );
  }

  const questions = await deps.getQuestions(input.topicId);
  const answers = Array.isArray(input.answers) ? input.answers : [];
  const { scored, invalid } = scoreAnswers(questions, answers);

  if (scored.length === 0) {
    // Nothing valid to record — no quiz_attempts row written (spec §6).
    return { scoredAnswers: [], feedback: [], score: 0, rejected: invalid };
  }

  // Partial answers remain valid for feedback, but mastery must reflect the
  // complete topic rather than only the questions answered in this request:
  // the denominator is every served question, answered or not. Multiple-select
  // and true/false are all-or-nothing, so each question is 0 or 1.
  const score = scored.filter((answer) => answer.correct).length / questions.length;
  const attemptId = await deps.insertAttempt({
    userId,
    topicId: input.topicId,
    score,
  });
  // Only valid, answered questions get a response row. Rejected answers
  // (unknown question, wrong type/shape, duplicates) never do, and
  // unanswered questions leave no row: the mastery estimate must treat
  // "not asked" and "answered wrong" differently. scoreAnswers keeps the
  // FIRST answer for a duplicated question id, and `scored` carries that
  // validated response, so history matches what was graded.
  await deps.insertResponses(
    scored.map((answer) => ({
      attemptId,
      questionId: answer.questionId,
      correct: answer.correct,
      response: answer.response,
      selectedChoiceIndex:
        answer.response.type === "single_choice" ? answer.response.choiceIndex : null,
    })),
  );
  await deps.onAttemptRecorded?.(userId, input.topicId);

  const byId = new Map(questions.map((q) => [q.id, q]));
  const feedback: QuestionFeedback[] = scored.map((answer) => {
    const question = byId.get(answer.questionId)!;
    return {
      questionId: answer.questionId,
      correct: answer.correct,
      correctAnswer: revealAnswer(question),
      explanation: question.explanation ?? null,
    };
  });

  return { scoredAnswers: scored, feedback, score, rejected: invalid };
}
