"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Button, buttonVariants } from "@/components/ui/button";
import { generateStudyPlan, setPlanItemDone } from "@/lib/planner-actions";
import { STAGES } from "@/lib/osn-stages";
import { buildTodayList, groupItemsByWeek, type ItemView, type PlannerPageData } from "@/lib/plan-view";
import { SettingsForm } from "./settings-form";
import { SelfRatingForm } from "./self-rating-form";

type PlanData = Extract<PlannerPageData, { state: "plan" }>;

function formatDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

const hoursLabel = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10}`;

export function PlanDashboard({ data }: { data: PlanData }) {
  const t = useTranslations("phase3.plan");
  const tErr = useTranslations("phase3.errors");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stage = STAGES[data.settings.stage];
  const { summary } = data;
  const todayList = buildTodayList(data.items, data.today);
  const weeks = groupItemsByWeek(data.items, data.today);
  const topicTitle = new Map(data.topics.map((x) => [x.topicId, x.title]));

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateStudyPlan();
      if (!result.ok) setError(tErr(result.reason));
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <p className="label-code">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {stage.label[locale as "en" | "id"]} · {data.settings.subject} ·{" "}
          {t("daysLeft", { days: data.daysLeft })} · {t("hoursPerWeek", { hours: data.settings.hoursPerWeek })}
        </p>
        {data.stageDates?.status === "projected" ? (
          <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">{t("projectedDates")}</p>
        ) : null}
      </header>

      {!summary.feasible ? (
        <div role="status" className="rounded-lg border border-amber-500/60 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">{t("infeasibleTitle")}</p>
          <p className="mt-1">
            {t("infeasibleBody", {
              needed: hoursLabel(summary.requiredMinutes),
              available: hoursLabel(summary.availableMinutes),
              short: hoursLabel(summary.shortfallMinutes),
            })}
          </p>
          {summary.droppedTopicIds.length > 0 ? (
            <p className="mt-2">
              {t("infeasibleDropped")}{" "}
              {summary.droppedTopicIds.slice(0, 8).map((id) => topicTitle.get(id) ?? id).join(", ")}
              {summary.droppedTopicIds.length > 8 ? "…" : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {data.staleSinceQuiz || data.settingsChanged ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm">
          <p>{data.settingsChanged ? t("staleSettings") : t("staleQuiz")}</p>
          <Button size="sm" onClick={regenerate} disabled={pending}>{t("regenerate")}</Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="text-xl font-semibold text-foreground">{t("today")}</h2>
        {todayList.overdue.length === 0 && todayList.today.length === 0 && todayList.upNext.length === 0 ? (
          <p className="mt-2 text-slate-600 dark:text-slate-300">{t("nothingToday")}</p>
        ) : null}
        {todayList.overdue.length > 0 ? (
          <div className="mt-3">
            <h3 className="font-mono text-xs uppercase tracking-wide text-red-700 dark:text-red-400">{t("overdue")}</h3>
            <ItemList items={todayList.overdue} locale={locale} subject={data.settings.subject} showDate />
          </div>
        ) : null}
        {todayList.today.length > 0 ? <ItemList items={todayList.today} locale={locale} subject={data.settings.subject} /> : null}
        {todayList.upNext.length > 0 ? (
          <div className="mt-3">
            <h3 className="font-mono text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">{t("upNext")}</h3>
            <ItemList items={todayList.upNext} locale={locale} subject={data.settings.subject} showDate />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-xl font-semibold text-foreground">{t("upcoming")}</h2>
        <div className="mt-3 space-y-3">
          {weeks.map((week, index) => (
            <details key={week.weekStart} open={index === 0} className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                {t("weekOf", { date: formatDay(week.weekStart, locale) })} ·{" "}
                {t("weekSummary", { hours: hoursLabel(week.minutes), done: week.doneCount, total: week.itemCount })}
              </summary>
              <div className="space-y-3 px-4 pb-4">
                {week.days.map((day) => (
                  <div key={day.date}>
                    <h3 className="font-mono text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      {formatDay(day.date, locale)} · {day.minutes} {t("min")}
                    </h3>
                    <ItemList items={day.items} locale={locale} subject={data.settings.subject} />
                  </div>
                ))}
              </div>
            </details>
          ))}
          {weeks.length === 0 ? <p className="text-slate-600 dark:text-slate-300">{t("nothingUpcoming")}</p> : null}
        </div>
      </section>

      <section aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="text-xl font-semibold text-foreground">{t("topics")}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t("masterySummary", {
            known: data.masteryCounts.known,
            uncertain: data.masteryCounts.uncertain,
            notKnown: data.masteryCounts.not_known,
            unverified: data.masteryCounts.unverified,
          })}
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card font-mono text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">{t("colTopic")}</th>
                <th className="px-3 py-2">{t("colRating")}</th>
                <th className="px-3 py-2">{t("colResult")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.topics.map((topic) => (
                <tr key={topic.topicId}>
                  <td className="px-3 py-2">
                    <Link href={`/planner/${data.settings.subject}/${topic.topicId}`} className="underline-offset-2 hover:underline">
                      {topic.title}
                    </Link>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{topic.sectionName}</span>
                  </td>
                  <td className="px-3 py-2">{topic.selfRating ?? "—"}</td>
                  <td className="px-3 py-2">
                    {topic.status === "unverified" ? (
                      <span className="text-slate-600 dark:text-slate-400">
                        {t("status.unverified")}
                        {!topic.canConfirm ? ` · ${t("noQuizYet")}` : ""}
                      </span>
                    ) : (
                      <span>
                        {t(`status.${topic.status}`)} · {Math.round(topic.pHat * 100)}% ({topic.answerCount})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {summary.topicsWithoutQuiz > 0 ? (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{t("noQuizNote", { count: summary.topicsWithoutQuiz })}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">{t("editRatings")}</summary>
          <div className="px-4 pb-4">
            <SelfRatingForm topics={data.topics} submitLabel={t("saveAndRegenerate")} onDone={() => router.refresh()} />
          </div>
        </details>
        <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">{t("editSettings")}</summary>
          <div className="px-4 pb-4">
            <SettingsForm
              initial={data.settings}
              submitLabel={t("saveAndRegenerate")}
              onSaved={({ subjectChanged }) => {
                if (subjectChanged) return router.refresh();
                regenerate();
              }}
            />
          </div>
        </details>
        <Button variant="outline" onClick={regenerate} disabled={pending}>{t("regenerate")}</Button>
      </section>
    </div>
  );
}

function ItemList({
  items,
  locale,
  subject,
  showDate = false,
}: {
  items: ItemView[];
  locale: string;
  subject: string;
  showDate?: boolean;
}) {
  const t = useTranslations("phase3.plan");
  const tReason = useTranslations("phase3.reason");
  const [pending, startTransition] = useTransition();
  const [doneOverride, setDoneOverride] = useState<Record<string, boolean>>({});
  const router = useRouter();

  function toggle(item: ItemView, done: boolean) {
    startTransition(async () => {
      const result = await setPlanItemDone(item.id, done);
      if (result.ok) {
        setDoneOverride((prev) => ({ ...prev, [item.id]: done }));
        router.refresh();
      }
    });
  }

  return (
    <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((item) => {
        const done = doneOverride[item.id] ?? item.done;
        const manual = item.kind !== "confirm";
        return (
          <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className={["text-sm font-medium", done ? "text-slate-600 line-through dark:text-slate-400" : "text-foreground"].join(" ")}>
                <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide dark:bg-slate-800">
                  {t(`kind.${item.kind}`)}
                </span>
                <Link href={`/planner/${subject}/${item.topicId}`} className="underline-offset-2 hover:underline">
                  {item.title}
                </Link>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {showDate ? `${formatDay(item.scheduledFor, locale)} · ` : ""}
                {item.minutes !== null ? `${item.minutes} ${t("min")} · ` : ""}
                {item.reason ? tReason(item.reason) : ""}
              </p>
            </div>
            {manual ? (
              <Button size="sm" variant="outline" disabled={pending} aria-pressed={done} onClick={() => toggle(item, !done)}>
                {done ? t("undo") : t("markDone")}
              </Button>
            ) : done ? (
              <span className="text-xs text-emerald-700 dark:text-emerald-400">{t("quizTaken")}</span>
            ) : (
              <Link href={`/planner/${subject}/${item.topicId}`} className={buttonVariants({ size: "sm" })}>
                {t("takeQuiz")}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
