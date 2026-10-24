import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import type { DayMinutes, TopicMinutes, WeeklyActivity, Coverage } from "@/lib/progress";
import type { MasteryStatus } from "@/lib/mastery";

const fmtDay = (locale: string, iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

// --- This week -----------------------------------------------------------------

// Seven days, Monday first. A day is "active" when real study happened (see
// lib/progress.ts); there is deliberately no streak and no "you missed a day"
// wording: a missed day costs nothing here.
export async function WeekStrip({
  week,
  plannedMinutes,
  locale,
}: {
  week: WeeklyActivity;
  plannedMinutes: number;
  locale: string;
}) {
  const t = await getTranslations("progress");
  return (
    <section aria-labelledby="week-heading" className="space-y-4">
      <h2 id="week-heading" className="text-xl font-semibold text-foreground">
        {t("week.heading")}
      </h2>
      <p className="text-foreground/80">
        {t("week.activeDays", { count: week.activeDays })}
      </p>
      <ol className="grid grid-cols-7 gap-1.5">
        {week.days.map((day) => (
          <li
            key={day.date}
            className={[
              "rounded-md border p-2 text-center text-xs",
              day.active
                ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                : "border-dashed border-border",
            ].join(" ")}
          >
            <span className="block font-medium text-foreground">
              {fmtDay(locale, day.date, { weekday: "short" })}
            </span>
            <span className="block text-muted-foreground">
              {day.active ? "✓" : "–"}
              <span className="sr-only">{day.active ? t("week.active") : t("week.inactive")}</span>
            </span>
            <span className="block text-muted-foreground">
              {t("minutesShort", { minutes: day.minutes })}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{t("week.activeRule")}</p>
      <p className="text-sm text-foreground/80">
        {t("week.plannedVsMeasured", { planned: plannedMinutes, measured: week.totalMinutes })}
      </p>
    </section>
  );
}

// --- Minutes per day -------------------------------------------------------------

export async function MinutesChart({ days, locale }: { days: DayMinutes[]; locale: string }) {
  const t = await getTranslations("progress");
  const max = Math.max(60, ...days.map((d) => d.minutes));
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  const W = 560;
  const H = 140;
  const gap = 6;
  const barW = (W - gap * (days.length - 1)) / days.length;

  return (
    <section aria-labelledby="chart-heading" className="space-y-3">
      <h2 id="chart-heading" className="text-xl font-semibold text-foreground">
        {t("chart.heading", { days: days.length })}
      </h2>
      <svg
        viewBox={`0 0 ${W} ${H + 20}`}
        role="img"
        aria-label={t("chart.alt", { days: days.length, total })}
        className="w-full max-w-2xl text-cherenkov-blue-800 dark:text-cherenkov-blue-pastel"
      >
        {days.map((day, i) => {
          const h = Math.round((day.minutes / max) * H);
          const x = i * (barW + gap);
          return (
            <g key={day.date}>
              <rect x={x} y={H - h} width={barW} height={Math.max(h, 0)} rx={2} fill="currentColor" />
              <rect x={x} y={H} width={barW} height={1} fill="currentColor" opacity={0.4} />
              {i % 2 === (days.length - 1) % 2 ? (
                <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="10" fill="currentColor">
                  {fmtDay(locale, day.date, { day: "numeric", month: "numeric" })}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {/* The same numbers as a table, for screen readers and anyone who wants them. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-foreground/80">{t("chart.showTable")}</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr>
              <th className="py-1 pr-4 font-medium">{t("chart.colDay")}</th>
              <th className="py-1 font-medium">{t("chart.colMinutes")}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className="border-t border-border">
                <td className="py-1 pr-4">{fmtDay(locale, day.date, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td className="py-1">{day.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export async function TopicMinutesList({
  rows,
}: {
  rows: (TopicMinutes & { label: string | null })[];
}) {
  const t = await getTranslations("progress");
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.minutes));
  return (
    <section aria-labelledby="topics-heading" className="space-y-3">
      <h2 id="topics-heading" className="text-xl font-semibold text-foreground">
        {t("topics.heading")}
      </h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={`${row.subject}/${row.syllabusTopicId}`} className="text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-foreground">{row.label ?? t("topics.unassigned")}</span>
              <span className="text-muted-foreground">{t("minutes", { minutes: row.minutes })}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-border" aria-hidden>
              <div
                className="h-1.5 rounded bg-cherenkov-blue-800 dark:bg-cherenkov-blue-pastel"
                style={{ width: `${Math.round((row.minutes / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Coverage map ----------------------------------------------------------------

// Status is carried by (1) a symbol, (2) a border style and (3) the word
// itself, never by colour alone. "Not enough data" is its own state and is
// never shown as "weak": it means nothing was measured, not that it went badly.
const STATUS_STYLE: Record<MasteryStatus, { symbol: string; box: string }> = {
  known: { symbol: "●", box: "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  uncertain: { symbol: "◐", box: "border-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  not_known: { symbol: "○", box: "border-rose-600 bg-rose-50 dark:bg-rose-950/40" },
  unverified: { symbol: "–", box: "border-dashed border-border-strong" },
};
const STATUS_ORDER: MasteryStatus[] = ["known", "uncertain", "not_known", "unverified"];

export async function CoverageMap({
  coverage,
  subject,
  stageLabel,
  sectionNames,
  topicNames,
  materialHref,
  syllabusHref,
}: {
  coverage: Coverage;
  subject: string;
  stageLabel: string;
  sectionNames: Record<string, string>;
  topicNames: Record<string, string>;
  materialHref: (slug: string) => string;
  syllabusHref: (topicId: string) => string;
}) {
  const t = await getTranslations("progress");
  const pct = (p: number | null) => (p === null ? "" : `${Math.round(p * 100)}%`);

  return (
    <section aria-labelledby="coverage-heading" className="space-y-4">
      <h2 id="coverage-heading" className="text-xl font-semibold text-foreground">
        {t("coverage.heading")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("coverage.basis", { stage: stageLabel })}</p>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label={t("coverage.legend")}>
        {STATUS_ORDER.map((status) => (
          <li key={status} className="text-foreground/80">
            <span aria-hidden className="mr-1">{STATUS_STYLE[status].symbol}</span>
            {t(`coverage.status.${status}` as never)} ({coverage.counts[status]})
          </li>
        ))}
        <li className="text-foreground/80">
          <span aria-hidden className="mr-1">✓</span>
          {t("coverage.understoodLegend", { count: coverage.understoodCount })}
        </li>
      </ul>

      <div className="space-y-5">
        {coverage.sections.map((section) => (
          <div key={section.sectionId}>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{sectionNames[section.sectionId]}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {section.cells.map((cell) => (
                <li
                  key={cell.topicId}
                  className={`rounded-md border p-3 text-sm ${STATUS_STYLE[cell.status].box}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={cell.materialSlug ? materialHref(cell.materialSlug) : syllabusHref(cell.topicId)}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {topicNames[cell.topicId]}
                    </Link>
                    {cell.understood ? (
                      <span title={t("coverage.understood")} className="shrink-0 text-emerald-700 dark:text-emerald-400">
                        ✓<span className="sr-only"> {t("coverage.understood")}</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-foreground/80">
                    <span aria-hidden className="mr-1">{STATUS_STYLE[cell.status].symbol}</span>
                    {t(`coverage.status.${cell.status}` as never)}
                    {cell.pHat !== null
                      ? ` · ${t("coverage.estimate", {
                          estimate: pct(cell.pHat),
                          low: pct(cell.pLower),
                          high: pct(cell.pUpper),
                          count: cell.answerCount,
                        })}`
                      : cell.answerCount === 0
                        ? ` · ${t("coverage.noAnswers")}`
                        : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("coverage.note", { subject })}</p>
    </section>
  );
}
