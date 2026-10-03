import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { SyllabusToggleAll } from "@/components/site/syllabus-toggle-all";
import { Link } from "@/i18n/routing";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { buildSubjectCoverage, type SectionEntry } from "@/lib/library";
import {
  getSyllabus,
  localize,
  sectionAnchor,
  topicAnchor,
} from "@/lib/syllabus";
import { SUBJECTS } from "@/lib/subjects";

export function generateStaticParams() {
  return SUBJECTS.map((subject) => ({ subject }));
}

const LIST_ID = "syllabus-sections";

export default async function SubjectSyllabusPage({
  params,
}: {
  params: Promise<{ locale: string; subject: string }>;
}) {
  const { locale, subject } = await params;
  setRequestLocale(locale);
  const syllabus = getSyllabus(subject);
  if (!syllabus) notFound();

  const t = await getTranslations("syllabus");
  const coverage = buildSubjectCoverage(syllabus, getAllMaterials(), getAllEditorials());
  const theory = coverage.sections.filter((entry) => entry.section.part === "theory");
  const practical = coverage.sections.filter((entry) => entry.section.part === "practical");
  const translated = syllabus.sourceLang !== locale;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/syllabus" className="label-code hover:text-slate-700 dark:hover:text-slate-200">
        ← {t("title")}
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-foreground">{t(`subjects.${syllabus.subject}`)}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        {t("source")}: {syllabus.source.label}
        {syllabus.source.edition ? ` · ${syllabus.source.edition}` : ""}
      </p>
      {translated && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("translationNote", { language: t(`languages.${syllabus.sourceLang}`) })}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="label-code">
          {t("counts.topics", { count: coverage.topicCount })} ·{" "}
          {t("counts.materials", { count: coverage.materialCount })} ·{" "}
          {t("counts.editorials", { count: coverage.editorialCount })}
        </p>
        <SyllabusToggleAll
          targetId={LIST_ID}
          expandLabel={t("expandAll")}
          collapseLabel={t("collapseAll")}
        />
      </div>

      <div id={LIST_ID} className="mt-6 space-y-3">
        <h2 className="label-code">{t("theory")}</h2>
        {theory.map((entry) => (
          <SectionBlock
            key={entry.section.id}
            entry={entry}
            subject={syllabus.subject}
            sourceLang={syllabus.sourceLang}
          />
        ))}

        {practical.length > 0 && (
          <>
            <h2 className="label-code pt-4">{t("practical")}</h2>
            {practical.map(({ section }) => (
              <div
                key={section.id}
                id={sectionAnchor(section.id)}
                className="rounded-lg border border-border bg-card p-4"
              >
                <h3 className="font-semibold text-foreground">{localize(section.name, locale)}</h3>
                {section.note && (
                  <p
                    lang={syllabus.sourceLang}
                    className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                  >
                    {section.note}
                  </p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

async function SectionBlock({
  entry,
  subject,
  sourceLang,
}: {
  entry: SectionEntry;
  subject: string;
  sourceLang: string;
}) {
  const locale = await getLocale();
  const t = await getTranslations("syllabus");
  const { section, topics } = entry;

  return (
    <details
      id={sectionAnchor(section.id)}
      open
      className="group rounded-lg border border-border bg-card"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="font-semibold text-foreground">{localize(section.name, locale)}</span>
        <span className="label-code ml-auto">{t("counts.topics", { count: topics.length })}</span>
      </summary>

      <ol className="divide-y divide-border border-t border-border">
        {topics.map(({ topic, material, editorials }) => (
          <li
            key={topic.id}
            id={topicAnchor(topic.id)}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <h3 className="font-medium text-foreground">{localize(topic.name, locale)}</h3>
              {topic.detail && (
                <p
                  lang={sourceLang}
                  className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                >
                  {topic.detail}
                </p>
              )}
              {editorials.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="label-code">{t("editorialsLabel")}</span>
                  {editorials.map((editorial) => (
                    <Link
                      key={editorial.slug}
                      href={`/archive/${editorial.subject}/${editorial.slug}`}
                      className="text-cherenkov-blue-700 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
                    >
                      {editorial.title}
                    </Link>
                  ))}
                </p>
              )}
            </div>

            <div className="shrink-0 sm:text-right">
              {material ? (
                <Link
                  href={`/materials/${subject}/${material.slug}`}
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-wide text-cherenkov-blue-700 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
                >
                  {t("readMaterial")} →
                </Link>
              ) : (
                <span className="label-code inline-flex min-h-11 items-center">
                  {t("comingSoon")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
