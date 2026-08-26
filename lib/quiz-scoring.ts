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

  for (const answer of submitted) {
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

// Fraction correct among ANSWERED questions only — spec §6's partial-failure
// rule: unanswered questions are never penalized, and no partial-topic score
// is fabricated for questions the user never attempted.
export function computeTopicScore(scored: ScoredAnswer[]): number {
  if (scored.length === 0) return 0;
  const correctCount = scored.filter((a) => a.correct).length;
  return correctCount / scored.length;
}

export interface SubmitQuizAttemptInput {
  topicId: string;
  answers: SubmittedAnswer[];
}

export interface QuizAttemptDeps {
  getAnswerKeys: (topicId: string) => Promise<QuizQuestionAnswerKey[]>;
  insertAttempt: (row: {
    userId: string;
    topicId: string;
    score: number;
  }) => Promise<void>;
  // Optional: PLANNER-002's completed_at auto-sync (decision #8). Injected
  // rather than imported directly so this module has no dependency on the
  // planner module, and so tests can assert it was (or wasn't) called
  // without needing a real plan to exist.
  onAttemptRecorded?: (userId: string, topicId: string) => Promise<void>;
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
  const answerKeys = await deps.getAnswerKeys(input.topicId);
  const { scored, invalid } = scoreAnswers(answerKeys, input.answers);

  if (scored.length === 0) {
    // Nothing valid to record — no quiz_attempts row written (spec §6).
    return { scoredAnswers: [], score: 0, rejected: invalid };
  }

  const score = computeTopicScore(scored);
  await deps.insertAttempt({ userId, topicId: input.topicId, score });
  await deps.onAttemptRecorded?.(userId, input.topicId);

  return { scoredAnswers: scored, score, rejected: invalid };
}
