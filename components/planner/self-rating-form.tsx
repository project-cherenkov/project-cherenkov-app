"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { saveTopicSelfRatings } from "@/lib/planner-settings-actions";
import { generateStudyPlan } from "@/lib/planner-actions";
import { SELF_RATING_MAX, SELF_RATING_MIN } from "@/lib/planner-vocab";
import type { TopicView } from "@/lib/plan-view";

export interface SelfRatingFormProps {
  topics: TopicView[];
  // Called once the plan has been generated.
  onDone: () => void;
  submitLabel: string;
}

const SCALE = Array.from({ length: SELF_RATING_MAX - SELF_RATING_MIN + 1 }, (_, i) => SELF_RATING_MIN + i);

export function SelfRatingForm({ topics, onDone, submitLabel }: SelfRatingFormProps) {
  const t = useTranslations("phase3.ratings");
  const tErr = useTranslations("phase3.errors");
  const [ratings, setRatings] = useState<Record<string, number>>(() =>
    Object.fromEntries(topics.filter((x) => x.selfRating !== null).map((x) => [x.syllabusTopicId, x.selfRating!])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sections = useMemo(() => {
    const map = new Map<string, { name: string; topics: TopicView[] }>();
    for (const topic of topics) {
      const entry = map.get(topic.sectionId) ?? { name: topic.sectionName, topics: [] };
      entry.topics.push(topic);
      map.set(topic.sectionId, entry);
    }
    return [...map.values()];
  }, [topics]);

  const ratedCount = Object.keys(ratings).length;

  function submit() {
    setError(null);
    startTransition(async () => {
      // Only rated topics are sent; an unrated topic stays "no opinion" (0.5
      // prior) rather than being saved as a made-up middle rating.
      const payload = Object.entries(ratings).map(([syllabusTopicId, rating]) => ({ syllabusTopicId, rating }));
      if (payload.length > 0) {
        const saved = await saveTopicSelfRatings(payload);
        if (!saved.ok) {
          setError(saved.reason === "unauthenticated" ? tErr("unauthenticated") : tErr("ratingsFailed"));
          return;
        }
      }
      const generated = await generateStudyPlan();
      if (!generated.ok) {
        setError(tErr(generated.reason));
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("scaleHelp")}</p>
      {sections.map((section) => (
        <fieldset key={section.name} className="rounded-lg border border-border bg-card p-4">
          <legend className="px-1 font-mono text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {section.name}
          </legend>
          <ul className="divide-y divide-border">
            {section.topics.map((topic) => (
              <li key={topic.topicId} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-foreground">{topic.title}</span>
                <div role="radiogroup" aria-label={topic.title} className="flex gap-1">
                  {SCALE.map((value) => {
                    const selected = ratings[topic.syllabusTopicId] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setRatings((prev) => ({ ...prev, [topic.syllabusTopicId]: value }))}
                        className={[
                          "h-9 w-9 rounded-md border text-sm font-medium transition-colors",
                          selected
                            ? "border-transparent bg-cherenkov-blue text-slate-900"
                            : "border-border text-foreground hover:bg-slate-100 dark:hover:bg-slate-800",
                        ].join(" ")}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      <div className="space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t("progress", { rated: ratedCount, total: topics.length })}
        </p>
        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <Button onClick={submit} disabled={pending}>{submitLabel}</Button>
      </div>
    </div>
  );
}
