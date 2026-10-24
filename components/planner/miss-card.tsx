"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { retryMissedQuestion, revealMissedAnswer } from "@/lib/misses-actions";
import { MarkdownText } from "@/components/viz/shared/markdown-text";

export interface MissCardData {
  questionId: string;
  prompt: string;
  choices: string[];
  difficulty: string;
  topicLabel: string;
  resolved: boolean;
  wrongCount: number;
  retryCount: number;
  // The choice picked on the latest wrong answer; null if it was not recorded.
  lastWrongChoice: number | null;
  materialHref: string | null;
  editorials: { href: string; title: string }[];
}

type Answer = { correctChoiceIndex: number; explanation: string | null };

// One missed question. The correct answer is NOT in the page's HTML or props:
// it only arrives after the student retries or explicitly asks to see it
// (otherwise "try again" would be pointless). Retrying records a practice
// answer that can resolve the miss but does not touch the mastery estimate or
// the plan.
export function MissCard({ data }: { data: MissCardData }) {
  const t = useTranslations("review");
  const groupId = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [resolved, setResolved] = useState(data.resolved);
  const [retryResult, setRetryResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function check() {
    if (selected === null) return;
    setError(null);
    startTransition(async () => {
      const result = await retryMissedQuestion({ questionId: data.questionId, selectedChoiceIndex: selected });
      if (!result.ok) {
        setError(t("error"));
        return;
      }
      setAnswer({ correctChoiceIndex: result.correctChoiceIndex, explanation: result.explanation });
      setRetryResult(result.correct);
      setResolved(result.correct);
    });
  }

  function reveal() {
    setError(null);
    startTransition(async () => {
      const result = await revealMissedAnswer(data.questionId);
      if (!result.ok) {
        setError(t("error"));
        return;
      }
      setAnswer({ correctChoiceIndex: result.correctChoiceIndex, explanation: result.explanation });
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="label-code">{data.topicLabel}</span>
        <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
          {t(`difficulty.${data.difficulty}` as never)}
        </span>
        <span
          className={
            resolved
              ? "rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          }
        >
          {resolved ? t("resolved") : t("open")}
        </span>
        <span className="text-muted-foreground">
          {t("missedCount", { count: data.wrongCount })}
          {data.retryCount > 0 ? ` · ${t("retriedCount", { count: data.retryCount })}` : ""}
        </span>
      </div>

      <MarkdownText text={data.prompt} className="mt-3 text-foreground" />

      <fieldset className="mt-4 space-y-2" disabled={pending || retryResult !== null}>
        <legend className="sr-only">{t("choices")}</legend>
        {data.choices.map((choice, index) => {
          const isCorrect = answer?.correctChoiceIndex === index;
          const wasMine = data.lastWrongChoice === index;
          return (
            <label
              key={index}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm",
                isCorrect ? "border-emerald-600" : "border-border",
              ].join(" ")}
            >
              <input
                type="radio"
                name={`${groupId}-choice`}
                checked={selected === index}
                onChange={() => setSelected(index)}
                className="mt-1"
              />
              <span className="min-w-0">
                <MarkdownText text={choice} inline />
                {/* Status is always spelled out in words, never colour alone. */}
                {isCorrect ? (
                  <span className="ml-2 font-medium text-emerald-700 dark:text-emerald-400">
                    ({t("correctAnswer")})
                  </span>
                ) : null}
                {wasMine ? (
                  <span className="ml-2 text-muted-foreground">({t("yourEarlierAnswer")})</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      {retryResult !== null ? (
        <p role="status" className="mt-3 text-sm font-medium text-foreground">
          {retryResult ? t("retryCorrect") : t("retryWrong")}
        </p>
      ) : null}

      {answer?.explanation ? (
        <div className="mt-3 rounded-md bg-muted p-3 text-sm">
          <p className="label-code mb-1">{t("explanation")}</p>
          <MarkdownText text={answer.explanation} />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {retryResult === null ? (
          <Button size="sm" onClick={check} disabled={pending || selected === null}>
            {t("check")}
          </Button>
        ) : null}
        {answer === null ? (
          <Button size="sm" variant="outline" onClick={reveal} disabled={pending}>
            {t("showAnswer")}
          </Button>
        ) : null}
      </div>

      {data.materialHref || data.editorials.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3 text-sm">
          <p className="label-code mb-1">{t("learnIt")}</p>
          <ul className="space-y-1">
            {data.materialHref ? (
              <li>
                <Link
                  href={data.materialHref}
                  className="text-cherenkov-blue-800 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
                >
                  {t("material")}
                </Link>
              </li>
            ) : null}
            {data.editorials.map((editorial) => (
              <li key={editorial.href}>
                <Link
                  href={editorial.href}
                  className="text-cherenkov-blue-800 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
                >
                  {editorial.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
