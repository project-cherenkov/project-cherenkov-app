import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/routing";
import {
  CoverageMap,
  MinutesChart,
  TopicMinutesList,
  WeekStrip,
} from "@/components/planner/progress-view";
import { SessionList, type SessionListItem } from "@/components/planner/session-list";
import { getCurrentUser } from "@/lib/auth-guard";
import { getAllMaterials } from "@/lib/content";
import { STAGES, todayInTimeZone } from "@/lib/osn-stages";
import { addDays, startOfWeek } from "@/lib/plan-dates";
import { planViewDeps } from "@/lib/plan-db";
import { DEFAULT_PLANNER_TIMEZONE } from "@/lib/planner-vocab";
import { buildCoverage, minutesByDay, minutesByTopic, weeklyActivity } from "@/lib/progress";
import { loadSubjectMastery } from "@/lib/progress-data";
import { pageMetadata } from "@/lib/seo-metadata";
import {
  loadAttemptTimesSince,
  loadPlannedMinutesBetween,
  loadSessionsSince,
  loadUnderstoodMarks,
} from "@/lib/study-session-db";
import { SUBJECTS, isKnownSubject, type Subject } from "@/lib/subjects";
import { getSyllabus, getTopicLocation, localize } from "@/lib/syllabus";

// Private progress views (R4). Everything is derived from what the student
// did: logged sessions, quiz attempts and their own "understood" marks.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "progress" });
  return pageMetadata({
    locale,
    path: "/planner/progress",
    title: t("title"),
    description: t("intro"),
    noindex: true,
  });
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, user, raw] = await Promise.all([getLocale(), getCurrentUser(), searchParams]);
  if (!user) redirect(`/${locale}/login`);

  const [t, ts] = await Promise.all([getTranslations("progress"), getTranslations("syllabus.subjects")]);

  const settings = await planViewDeps.getSettings(user.id);
  const timeZone = settings?.timezone ?? DEFAULT_PLANNER_TIMEZONE;
  const now = new Date();
  const today = todayInTimeZone(now, timeZone);
  const week = startOfWeek(today);

  const rawSubject = Array.isArray(raw.subject) ? raw.subject[0] : raw.subject;
  const subject: Subject =
    rawSubject && isKnownSubject(rawSubject) ? rawSubject : (settings?.subject ?? "informatics");
  const stage = settings?.stage ?? "osn_k";

  const since = new Date(now.getTime() - 31 * 86_400_000);
  const [sessions, attemptTimes, plannedMinutes, marks, mastery] = await Promise.all([
    loadSessionsSince(user.id, since),
    loadAttemptTimesSince(user.id, new Date(now.getTime() - 8 * 86_400_000)),
    loadPlannedMinutesBetween(user.id, week, addDays(week, 6)),
    loadUnderstoodMarks(user.id),
    loadSubjectMastery(planViewDeps, user.id, subject, stage, now),
  ]);

  const weekly = weeklyActivity(today, sessions, attemptTimes, timeZone);
  const days = minutesByDay(today, sessions, timeZone, 14);

  const labelFor = (s: string | null, topicId: string | null): string | null => {
    if (!s || !topicId) return null;
    const located = getTopicLocation(s, topicId);
    return located ? `${isKnownSubject(s) ? ts(s) : s} · ${localize(located.topic.name, locale)}` : null;
  };

  const topicRows = minutesByTopic(sessions).map((row) => ({
    ...row,
    label: labelFor(row.subject, row.syllabusTopicId),
  }));

  // Coverage for the chosen subject.
  const syllabus = getSyllabus(subject)!;
  const materials = getAllMaterials().filter((m) => m.subject === subject);
  const materialSlugByTopic = new Map(materials.map((m) => [m.topic, m.slug]));
  const understoodMaterials = new Set(
    marks.filter((m) => m.kind === "material" && m.subject === subject).map((m) => m.slug),
  );
  const coverage = buildCoverage(syllabus, mastery.estimates, materialSlugByTopic, understoodMaterials);
  const sectionNames: Record<string, string> = {};
  const topicNames: Record<string, string> = {};
  for (const section of syllabus.sections) {
    sectionNames[section.id] = localize(section.name, locale);
    for (const topic of section.topics) topicNames[topic.id] = localize(topic.name, locale);
  }

  const dateTime = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  const recent: SessionListItem[] = sessions.slice(0, 10).map((s) => ({
    id: s.id,
    when: dateTime.format(s.startedAt),
    minutes: Math.round(s.durationSeconds / 60),
    topicLabel: labelFor(s.subject, s.syllabusTopicId),
    source: s.source === "manual" ? "manual" : "timer",
  }));
  const hasAnyData = sessions.length > 0 || attemptTimes.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
      <header>
        <p className="label-code">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{t("intro")}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("privacyNote")}</p>
      </header>

      <WeekStrip week={weekly} plannedMinutes={plannedMinutes} locale={locale} />

      {hasAnyData ? (
        <>
          <MinutesChart days={days} locale={locale} />
          <TopicMinutesList rows={topicRows} />
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-slate-600 dark:text-slate-400">
          {t("emptyState")}{" "}
          <Link href="/timer" className="underline underline-offset-4">
            {t("openTimer")}
          </Link>
        </p>
      )}

      <nav aria-label={t("coverage.subjectNav")} className="flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <Link
            key={s}
            href={`/planner/progress?subject=${s}`}
            aria-current={s === subject ? "page" : undefined}
            className={[
              "inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium",
              s === subject
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-border text-foreground hover:bg-slate-100 dark:hover:bg-slate-800",
            ].join(" ")}
          >
            {ts(s)}
          </Link>
        ))}
      </nav>
      <CoverageMap
        coverage={coverage}
        subject={ts(subject)}
        stageLabel={STAGES[mastery.stage].label[locale === "id" ? "id" : "en"]}
        sectionNames={sectionNames}
        topicNames={topicNames}
        materialHref={(slug) => `/materials/${subject}/${slug}`}
        syllabusHref={(topicId) => `/syllabus/${subject}#topic-${topicId}`}
      />

      <section aria-labelledby="sessions-heading" className="space-y-3">
        <h2 id="sessions-heading" className="text-xl font-semibold text-foreground">
          {t("sessions.heading")}
        </h2>
        <SessionList items={recent} />
      </section>
    </div>
  );
}
