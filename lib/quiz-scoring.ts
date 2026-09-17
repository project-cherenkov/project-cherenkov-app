// QUIZ-001. Pure scoring logic plus a dependency-injected orchestration
// function, kept separate from the "use server" action (lib/quiz-actions.ts)
// specifically so §8's forged-score test can exercise the real submission
// logic with fake in-memory deps — no live database, no mocking Drizzle's
// query builder.

export interface QuizQuestionAnswerKey {
  id: string;
  correctChoiceIndex: number;
  choiceCount: number;
}

export interface SubmittedAnswer {
  questionId: string;
  selectedChoiceIndex: number;
}

export interface ScoredAnswer {
  questionId: string;
  correct: boolean;
}

// Never receives or trusts anything the client claims about correctness —
// only answerKeys (server-fetched, real correct_choice_index) and the
// client's selectedChoiceIndex per question are used (spec §5, §9 HIGH
// risk). An answer referencing an unknown questionId, or a
// selectedChoiceIndex outside that question's choices array, is rejected
// outright (spec §6 validation) rather than silently scored as wrong.
export function scoreAnswers(
  answerKeys: QuizQuestionAnswerKey[],
  submitted: SubmittedAnswer[],
): { scored: ScoredAnswer[]; invalid: SubmittedAnswer[] } {
  const keysById = new Map(answerKeys.map((k) => [k.id, k]));
  const scored: ScoredAnswer[] = [];
  const invalid: SubmittedAnswer[] = [];
  const seenQuestionIds = new Set<string>();

  for (const answer of submitted) {
    if (seenQuestionIds.has(answer.questionId)) {
      invalid.push(answer);
      continue;
    }
    seenQuestionIds.add(answer.questionId);
    const key = keysById.get(answer.questionId);
    if (
      !key ||
      answer.selectedChoiceIndex < 0 ||
      answer.selectedChoiceIndex >= key.choiceCount
    ) {
      invalid.push(answer);
      continue;
    }
    scored.push({
      questionId: answer.questionId,
      correct: answer.selectedChoiceIndex === key.correctChoiceIndex,
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

export interface QuizAttemptTxDeps {
  getAnswerKeys: (topicId: string) => Promise<QuizQuestionAnswerKey[]>;
  insertAttempt: (row: {
    userId: string;
    topicId: string;
    score: number;
  }) => Promise<void>;
  onAttemptRecorded?: (userId: string, topicId: string) => Promise<void>;
}

export interface QuizAttemptDeps extends QuizAttemptTxDeps {
  transaction?: <T>(
    callback: (tx: QuizAttemptTxDeps) => Promise<T>,
  ) => Promise<T>;
}

export interface SubmitQuizAttemptResult {
  scoredAnswers: ScoredAnswer[];
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

  const answerKeys = await deps.getAnswerKeys(input.topicId);
  const { scored, invalid } = scoreAnswers(answerKeys, input.answers);

  if (scored.length === 0) {
    // Nothing valid to record — no quiz_attempts row written (spec §6).
    return { scoredAnswers: [], score: 0, rejected: invalid };
  }

  // Partial answers remain valid for feedback, but mastery must reflect the
  // complete topic rather than only the questions answered in this request.
  const score = scored.filter((answer) => answer.correct).length / answerKeys.length;
  await deps.insertAttempt({ userId, topicId: input.topicId, score });
  await deps.onAttemptRecorded?.(userId, input.topicId);

  return { scoredAnswers: scored, score, rejected: invalid };
}
