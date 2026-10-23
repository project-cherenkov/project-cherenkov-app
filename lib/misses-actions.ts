"use server";

import { getCurrentUser } from "@/lib/auth-guard";
import { retryDeps } from "@/lib/misses-db";
import {
  retryMissedQuestionCore,
  revealMissedAnswerCore,
  type RetryInput,
  type RetryResult,
  type RevealResult,
} from "@/lib/misses-retry";

export type RetryMissedQuestionResult = RetryResult | { ok: false; reason: "unauthenticated" };

// Session first, always: the user comes from the server-side session, never
// from the request body.
export async function retryMissedQuestion(
  input: RetryInput,
): Promise<RetryMissedQuestionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  return retryMissedQuestionCore(retryDeps, user.id, {
    questionId: input?.questionId,
    selectedChoiceIndex: input?.selectedChoiceIndex,
  });
}

export async function revealMissedAnswer(
  questionId: string,
): Promise<RevealResult | { ok: false; reason: "unauthenticated" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  return revealMissedAnswerCore(retryDeps, user.id, String(questionId));
}
