import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo-metadata";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { buildSubjectCoverage } from "@/lib/library";
import { getAllSyllabi } from "@/lib/syllabus";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "syllabus" });
  return pageMetadata({
    locale,
    path: "/syllabus",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function SyllabusIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("syllabus");
  const materials = getAllMaterials();
  const editorials = getAllEditorials();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="label-pixel" aria-hidden="true">{t("eyebrow")}</p>
      <h1 className="font-pixel mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-foreground/75">{t("description")}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {getAllSyllabi().map((syllabus) => {
          const coverage = buildSubjectCoverage(syllabus, materials, editorials);
          const empty = coverage.materialCount === 0 && coverage.editorialCount === 0;
          return (
            <Link
              key={syllabus.subject}
              href={`/syllabus/${syllabus.subject}`}
              className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-cherenkov-blue-pastel"
            >
              <span className="label-code text-cherenkov-blue-800 dark:text-cherenkov-blue-pastel">
                {syllabus.subject}
              </span>
              <h2 className="mt-2 text-xl font-semibold text-foreground group-hover:underline">
                {t(`subjects.${syllabus.subject}`)}
              </h2>
              <p className="mt-1 text-sm text-foreground/75">
                {t(`descriptions.${syllabus.subject}`)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {syllabus.sources.map((source) => source.short).join(", ")}
              </p>
              {empty ? (
                <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                  {t("counts.coming")}
                </p>
              ) : (
                <>
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-xs text-foreground">
                    <dd>{t("counts.topics", { count: coverage.topicCount })}</dd>
                    <dd>{t("counts.materials", { count: coverage.materialCount })}</dd>
                    <dd>{t("counts.editorials", { count: coverage.editorialCount })}</dd>
                  </dl>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={t("coverage.label", { covered: coverage.coveredTopicCount, total: coverage.topicCount })}
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${coverage.topicCount ? Math.round((coverage.coveredTopicCount / coverage.topicCount) * 100) : 0}%` }}
                    />
                  </div>
                </>
              )}
              <span className="mt-4 text-sm font-medium text-brand group-hover:underline">
                {t("open")} <span aria-hidden="true">›</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
