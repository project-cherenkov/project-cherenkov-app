import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import "katex/dist/katex.min.css";

import { MissCard, type MissCardData } from "@/components/planner/miss-card";
import { getCurrentUser } from "@/lib/auth-guard";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { buildMissEntries, filterMisses, parseMissFilters } from "@/lib/misses";
import { loadMissData } from "@/lib/misses-db";
import { pageMetadata } from "@/lib/seo-metadata";
import { SUBJECTS } from "@/lib/subjects";
import { getTopicLocation, localize } from "@/lib/syllabus";

// "Review my misses" (R2): the questions the student got wrong, newest first,
// with a way to retry each one. Private and per-user, so dynamic and noindex.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return pageMetadata({
    locale,
    path: "/planner/review",
    title: t("title"),
    description: t("intro"),
    noindex: true,
  });
}

const selectClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, user, raw] = await Promise.all([getLocale(), getCurrentUser(), searchParams]);
  if (!user) redirect(`/${locale}/login`);

  const [t, ts] = await Promise.all([getTranslations("review"), getTranslations("syllabus.subjects")]);
  const filters = parseMissFilters(raw, SUBJECTS);

  const { events, questions } = await loadMissData(user.id);
  const all = buildMissEntries(events, questions);
  const shown = filterMisses(all, filters, new Date());

  const materials = getAllMaterials();
  const editorials = getAllEditorials();

  const cards: MissCardData[] = shown.map((entry) => {
    const q = entry.question;
    const located = q.syllabusTopicId ? getTopicLocation(q.subject, q.syllabusTopicId) : undefined;
    const topicName = located ? localize(located.topic.name, locale) : t("unknownTopic");
    const material = q.syllabusTopicId
      ? materials.find((m) => m.subject === q.subject && m.topic === q.syllabusTopicId)
      : undefined;
    return {
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices,
      difficulty: q.difficulty,
      topicLabel: `${ts(q.subject)} · ${topicName}`,
      resolved: entry.resolved,
      wrongCount: entry.wrongCount,
      retryCount: entry.retryCount,
      lastWrongChoice: entry.lastWrongChoice,
      materialHref: material ? `/materials/${material.subject}/${material.slug}` : null,
      editorials: q.syllabusTopicId
        ? editorials
            .filter((e) => e.subject === q.subject && e.syllabusTopic === q.syllabusTopicId)
            .map((e) => ({ href: `/archive/${e.subject}/${e.slug}`, title: e.title }))
        : [],
    };
  });

  // Topic options for the filter: only topics the student actually missed,
  // within the chosen subject.
  const topicOptions = new Map<string, string>();
  for (const entry of all) {
    const q = entry.question;
    if (!q.syllabusTopicId || (filters.subject && q.subject !== filters.subject)) continue;
    const located = getTopicLocation(q.subject, q.syllabusTopicId);
    if (located) topicOptions.set(q.syllabusTopicId, localize(located.topic.name, locale));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <p className="label-code">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{t("intro")}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("practiceNote")}</p>
      </header>

      <form method="get" className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-5">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">{t("filters.subject")}</span>
          <select name="subject" defaultValue={filters.subject ?? ""} className={selectClass}>
            <option value="">{t("filters.all")}</option>
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {ts(subject)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">{t("filters.topic")}</span>
          <select name="topic" defaultValue={filters.topic ?? ""} className={selectClass}>
            <option value="">{t("filters.all")}</option>
            {[...topicOptions].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">{t("filters.state")}</span>
          <select name="state" defaultValue={filters.state} className={selectClass}>
            <option value="open">{t("filters.stateOpen")}</option>
            <option value="resolved">{t("filters.stateResolved")}</option>
            <option value="all">{t("filters.all")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">{t("filters.recency")}</span>
          <select name="recency" defaultValue={filters.recency} className={selectClass}>
            <option value="all">{t("filters.all")}</option>
            <option value="7d">{t("filters.last7")}</option>
            <option value="30d">{t("filters.last30")}</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="min-h-10 w-full rounded-md border border-slate-500 px-4 text-sm font-medium text-foreground hover:bg-slate-100 dark:border-slate-400 dark:hover:bg-slate-800"
          >
            {t("filters.apply")}
          </button>
        </div>
      </form>

      <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
        {t("summary", { shown: cards.length, total: all.length })}
      </p>

      {cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-slate-600 dark:text-slate-400">
          {all.length === 0 ? t("emptyNoMisses") : t("emptyFiltered")}
        </p>
      ) : (
        <ul className="space-y-4">
          {cards.map((card) => (
            <MissCard key={card.questionId} data={card} />
          ))}
        </ul>
      )}
    </div>
  );
}
