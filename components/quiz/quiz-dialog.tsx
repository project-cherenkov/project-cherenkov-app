"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { submitQuizAttempt, type SubmitQuizResult } from "@/lib/quiz-actions";
import { QuestionInput } from "@/components/quiz/question-input";
import { draftProgress, draftToResponse, emptyDraft, type AnswerDraft } from "@/lib/quiz-draft";
import { MarkdownText } from "@/components/viz/shared/markdown-text";
import type { PublicQuizQuestion } from "@/lib/quiz";

export interface QuizDialogProps {
  topicId: string;
  questions: PublicQuizQuestion[];
}

type Feedback = Extract<SubmitQuizResult, { ok: true }>["results"];

// QUIZ-001. First real use of components/ui/dialog.tsx and tabs.tsx
// (previously imported nowhere — see docs/history/deployment-readiness.md). Tabs
// page through a topic's questions inside one Dialog; submitting calls
// lib/quiz-actions.ts's Server Action, which is the only place that ever
// sees `questions` alongside their real correct answers.
//
// Rendered within the already-established NextIntlClientProvider tree
// (app/[locale]/layout.tsx), so this uses useTranslations() directly rather
// than prop-drilled label strings — unlike components/planner/plan-overview.tsx,
// this component isn't unit-render-tested outside a real Next.js tree, so it
// doesn't need to avoid that context the way PlanOverview deliberately does.
export function QuizDialog({ topicId, questions }: QuizDialogProps) {
  const t = useTranslations("quiz");
  const router = useRouter();
  // One draft per question id; a question with no entry is untouched.
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [activeTab, setActiveTab] = useState("0");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<
    "unauthenticated" | "no_valid_answers" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  if (questions.length === 0) return null;

  const draftFor = (question: PublicQuizQuestion): AnswerDraft =>
    drafts[question.id] ?? emptyDraft(question.content);

  // Only complete, valid answers are submitted: a true/false question with an
  // unmarked statement, or a numeric field that is not a number, counts as
  // unanswered (no response row, per the existing partial-submission rules).
  const answeredResponses = questions.flatMap((question) => {
    const response = draftToResponse(draftFor(question));
    return response ? [{ questionId: question.id, response }] : [];
  });

  function handleSubmit() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await submitQuizAttempt({ topicId, answers: answeredResponses });
      if (result.ok) {
        setFeedback(result.results);
        setScore(result.score);
        router.refresh();
      } else {
        // UX-001 / TICKET-07: previously this branch did nothing — the
        // pending state cleared and the user got no indication anything
        // had gone wrong. `unauthenticated` (a real scenario if the
        // session expires mid-quiz) gets its own message pointing at
        // re-login; any other reason falls back to a generic retry
        // prompt.
        setSubmitError(result.reason);
      }
    });
  }

  function handleRetake() {
    setDrafts({});
    setFeedback(null);
    setScore(null);
    setSubmitError(null);
    setActiveTab("0");
  }

  return (
    <Dialog onOpenChange={(open) => !open && handleRetake()}>
      <DialogTrigger asChild>
        <Button>{t("startButton")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{t("startButton")}</DialogTitle>
        {score !== null ? (
          <DialogDescription>
            {t("scoreLabel", { score: Math.round(score * 100) })}
          </DialogDescription>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {questions.map((question, index) => {
              const graded = feedback?.find((f) => f.questionId === question.id);
              const progress = draftProgress(draftFor(question));
              const answered = progress === "answered";
              // Number plus a state mark, so the reader can see which
              // questions are still open before submitting. The mark is
              // decorative; the state is in the accessible name.
              const label = graded
                ? graded.correct
                  ? t("tabCorrect", { n: index + 1 })
                  : t("tabIncorrect", { n: index + 1 })
                : answered
                  ? t("tabAnswered", { n: index + 1 })
                  : progress === "partial"
                    ? t("tabPartial", { n: index + 1 })
                    : t("tabUnanswered", { n: index + 1 });
              return (
                <TabsTrigger key={question.id} value={String(index)} aria-label={label}>
                  {index + 1}
                  {graded ? (
                    graded.correct ? (
                      <Check className="h-3 w-3 text-success" aria-hidden />
                    ) : (
                      <X className="h-3 w-3 text-danger" aria-hidden />
                    )
                  ) : answered ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {questions.map((question, index) => {
            const result = feedback?.find((f) => f.questionId === question.id);
            return (
              <TabsContent key={question.id} value={String(index)}>
                <p className="label-mono mb-2">
                  {t("questionCounter", {
                    current: index + 1,
                    total: questions.length,
                  })}
                </p>
                <MarkdownText text={question.prompt} className="mb-3 font-medium" />
                <QuestionInput
                  content={question.content}
                  draft={draftFor(question)}
                  onChange={(draft) => setDrafts((prev) => ({ ...prev, [question.id]: draft }))}
                  disabled={feedback !== null}
                  revealed={result?.correctAnswer ?? null}
                  submitted={result ? draftToResponse(draftFor(question)) : null}
                />
                {result ? (
                  <p
                    className={
                      result.correct
                        ? "mt-2 text-sm text-success"
                        : "mt-2 text-sm text-danger"
                    }
                  >
                    {result.correct ? t("correct") : t("incorrect")}
                  </p>
                ) : null}
                {result?.explanation ? (
                  <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                    <p className="label-code mb-1">{t("explanation")}</p>
                    <MarkdownText text={result.explanation} />
                  </div>
                ) : null}
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="mt-4">
          {submitError ? (
            <p role="alert" className="mb-2 text-sm text-danger">
              {submitError === "unauthenticated"
                ? t("submitErrorUnauthenticated")
                : t("submitErrorGeneric")}
            </p>
          ) : null}
          {feedback === null ? (
            <Button
              onClick={handleSubmit}
              disabled={isPending || answeredResponses.length === 0}
            >
              {t("submit")}
            </Button>
          ) : (
            <Button onClick={handleRetake}>{t("retake")}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
