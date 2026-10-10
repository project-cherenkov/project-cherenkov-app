import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo-metadata";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { buildSubjectCoverage } from "@/lib/library";
import { getAllSyllabi, localize } from "@/lib/syllabus";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "materials" });
  return pageMetadata({
    locale,
    path: "/materials",
    title: t("title"),
    description: t("description"),
  });
}

// Same shape as the syllabus (subject → section → topic), because materials
// ARE the syllabus broken down — only sections that have a material show up.
export default async function MaterialsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("materials");
  const ts = await getTranslations("syllabus");
  const materials = getAllMaterials();
  const editorials = getAllEditorials();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">{t("description")}</p>

      <div className="mt-8 space-y-10">
        {getAllSyllabi().map((syllabus) => {
          const coverage = buildSubjectCoverage(syllabus, materials, editorials);
          const withMaterial = coverage.sections
            .map((entry) => ({
              ...entry,
              topics: entry.topics.filter((topic) => topic.material),
            }))
            .filter((entry) => entry.topics.length > 0);

          return (
            <section key={syllabus.subject} id={syllabus.subject} aria-labelledby={`${syllabus.subject}-heading`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
                <h2 id={`${syllabus.subject}-heading`} className="text-xl font-semibold text-foreground">
                  {ts(`subjects.${syllabus.subject}`)}
                </h2>
                <p className="label-code">
                  {t("coverage", {
                    covered: coverage.materialCount,
                    total: coverage.topicCount,
                  })}{" "}
                  ·{" "}
                  <Link
                    href={`/syllabus/${syllabus.subject}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {t("viewSyllabus")}
                  </Link>
                </p>
              </div>

              {withMaterial.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  {t("emptyForSubject")}
                </p>
              ) : (
                <div className="mt-4 space-y-6">
                  {withMaterial.map(({ section, topics }) => (
                    <div key={section.id}>
                      <h3 className="label-code mb-2">{localize(section.name, locale)}</h3>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {topics.map(({ topic, material }) => (
                          <li key={topic.id}>
                            <Link
                              href={`/materials/${syllabus.subject}/${material!.slug}`}
                              className="group block h-full rounded-lg border border-border bg-card p-4 transition-colors hover:border-cherenkov-blue-pastel"
                            >
                              <span className="font-semibold text-foreground group-hover:underline">
                                {material!.title}
                              </span>
                              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                                {localize(topic.name, locale)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
