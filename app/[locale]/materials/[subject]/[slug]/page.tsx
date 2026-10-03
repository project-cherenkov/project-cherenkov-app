import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MaterialMDX } from "@/components/material-mdx";
import { Link } from "@/i18n/routing";
import { getAllEditorials, getAllMaterials, getMaterial } from "@/lib/content";
import { buildSubjectCoverage, getSectionNeighbours } from "@/lib/library";
import { getSyllabus, getTopicLocation, localize, topicAnchor } from "@/lib/syllabus";
// Imported here, not globally — KaTeX's CSS only ships to pages that render
// math (Non-Functional Requirements §8), same as the editorial page.
import "katex/dist/katex.min.css";

export function generateStaticParams() {
  return getAllMaterials().map((material) => ({
    subject: material.subject,
    slug: material.slug,
  }));
}

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ locale: string; subject: string; slug: string }>;
}) {
  const { locale, subject, slug } = await params;
  setRequestLocale(locale);
  const material = getMaterial(subject, slug);
  const syllabus = getSyllabus(subject);
  if (!material || !syllabus) notFound();

  const t = await getTranslations("materials");
  const ts = await getTranslations("syllabus");
  const location = getTopicLocation(subject, material.topic);
  const coverage = buildSubjectCoverage(syllabus, getAllMaterials(), getAllEditorials());
  const topicEntry = coverage.sections
    .flatMap((entry) => entry.topics)
    .find((entry) => entry.topic.id === material.topic);
  const related = topicEntry?.editorials ?? [];
  const { previous, next } = getSectionNeighbours(coverage, material.topic);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/materials" className="label-code hover:text-slate-700 dark:hover:text-slate-200">
        ← {t("backToMaterials")}
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="label-code rounded bg-slate-100 px-2 py-0.5 text-cherenkov-blue-700 dark:bg-slate-800 dark:text-cherenkov-blue-pastel">
          {ts(`subjects.${subject}`)}
        </span>
        {location && (
          <Link
            href={`/syllabus/${subject}#${topicAnchor(location.topic.id)}`}
            className="label-code underline-offset-4 hover:underline"
          >
            {t("inSyllabus")}: {localize(location.section.name, locale)} › {localize(location.topic.name, locale)}
          </Link>
        )}
      </div>

      <h1 className="mt-3 text-3xl font-bold text-foreground">{material.title}</h1>
      <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">{material.summary}</p>

      <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
        <MaterialMDX code={material.body} />
      </div>

      {related.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="label-code mb-3">{t("relatedEditorials")}</h2>
          <ul className="space-y-2">
            {related.map((editorial) => (
              <li key={editorial.slug}>
                <Link
                  href={`/archive/${editorial.subject}/${editorial.slug}`}
                  className="text-cherenkov-blue-700 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
                >
                  {editorial.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(previous || next) && (
        <nav
          aria-label={t("sectionNav")}
          className="mt-10 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
        >
          {previous ? (
            <Link
              href={`/materials/${previous.subject}/${previous.slug}`}
              className="rounded-lg border border-border p-4 hover:border-cherenkov-blue-pastel"
            >
              <span className="label-code block">← {t("previous")}</span>
              <span className="font-medium text-foreground">{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/materials/${next.subject}/${next.slug}`}
              className="rounded-lg border border-border p-4 hover:border-cherenkov-blue-pastel sm:text-right"
            >
              <span className="label-code block">{t("next")} →</span>
              <span className="font-medium text-foreground">{next.title}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
