import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { buildSubjectCoverage } from "@/lib/library";
import { getAllSyllabi } from "@/lib/syllabus";

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
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">{t("description")}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {getAllSyllabi().map((syllabus) => {
          const coverage = buildSubjectCoverage(syllabus, materials, editorials);
          return (
            <Link
              key={syllabus.subject}
              href={`/syllabus/${syllabus.subject}`}
              className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-cherenkov-blue-pastel"
            >
              <span className="label-code text-cherenkov-blue-700 dark:text-cherenkov-blue-pastel">
                {syllabus.subject}
              </span>
              <h2 className="mt-2 text-xl font-semibold text-foreground group-hover:underline">
                {t(`subjects.${syllabus.subject}`)}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {syllabus.source.label}
                {syllabus.source.edition ? ` · ${syllabus.source.edition}` : ""}
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 font-mono text-xs">
                <Stat label={t("stats.topics")} value={coverage.topicCount} />
                <Stat label={t("stats.materials")} value={coverage.materialCount} />
                <Stat label={t("stats.editorials")} value={coverage.editorialCount} />
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="text-lg font-semibold text-foreground">{value}</dd>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
    </div>
  );
}
