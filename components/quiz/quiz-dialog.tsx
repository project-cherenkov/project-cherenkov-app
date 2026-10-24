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
import { submitQuizAttempt } from "@/lib/quiz-actions";
import { MarkdownText } from "@/components/viz/shared/markdown-text";
import type { PublicQuizQuestion } from "@/lib/quiz";

export interface QuizDialogProps {
  topicId: string;
  questions: PublicQuizQuestion[];
}

type Feedback = { questionId: string; correct: boolean }[];

// QUIZ-001. First real use of components/ui/dialog.tsx and tabs.tsx
// (previously imported nowhere — see docs/deployment-readiness.md). Tabs
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
  const t = useTranslations("phase2.quiz");
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("0");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<
    "unauthenticated" | "no_valid_answers" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  if (questions.length === 0) return null;

  function selectAnswer(questionId: string, choiceIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceIndex }));
  }

  function handleSubmit() {
    setSubmitError(null);
    startTransition(async () => {
      const submitted = Object.entries(answers).map(
        ([questionId, selectedChoiceIndex]) => ({
          questionId,
          selectedChoiceIndex,
        }),
      );
      const result = await submitQuizAttempt({ topicId, answers: submitted });
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
    setAnswers({});
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
              const answered = answers[question.id] !== undefined;
              // Number plus a state mark, so the reader can see which
              // questions are still open before submitting. The mark is
              // decorative; the state is in the accessible name.
              const label = graded
                ? graded.correct
                  ? t("tabCorrect", { n: index + 1 })
                  : t("tabIncorrect", { n: index + 1 })
                : answered
                  ? t("tabAnswered", { n: index + 1 })
                  : t("tabUnanswered", { n: index + 1 });
              return (
                <TabsTrigger key={question.id} value={String(index)} aria-label={label}>
                  {index + 1}
                  {graded ? (
                    graded.correct ? (
                      <Check className="h-3 w-3 text-emerald-700 dark:text-emerald-400" aria-hidden />
                    ) : (
                      <X className="h-3 w-3 text-red-700 dark:text-red-400" aria-hidden />
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
                <div className="flex flex-col gap-2">
                  {question.choices.map((choice, choiceIndex) => (
                    <label
                      key={choiceIndex}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm hover:bg-muted has-[:checked]:border-border-strong has-[:checked]:bg-muted"
                    >
                      <input
                        className="h-4 w-4 shrink-0"
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === choiceIndex}
                        onChange={() => selectAnswer(question.id, choiceIndex)}
                        disabled={feedback !== null}
                      />
                      <MarkdownText text={choice} inline />
                    </label>
                  ))}
                </div>
                {result ? (
                  <p
                    className={
                      result.correct
                        ? "mt-2 text-sm text-emerald-700 dark:text-emerald-400"
                        : "mt-2 text-sm text-red-700 dark:text-red-400"
                    }
                  >
                    {result.correct ? t("correct") : t("incorrect")}
                  </p>
                ) : null}
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="mt-4">
          {submitError ? (
            <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-400">
              {submitError === "unauthenticated"
                ? t("submitErrorUnauthenticated")
                : t("submitErrorGeneric")}
            </p>
          ) : null}
          {feedback === null ? (
            <Button
              onClick={handleSubmit}
              disabled={isPending || Object.keys(answers).length === 0}
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
