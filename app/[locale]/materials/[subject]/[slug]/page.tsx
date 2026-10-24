import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MaterialMDX } from "@/components/material-mdx";
import { MaterialNav, type MaterialNavSection } from "@/components/site/material-nav";
import { UnderstoodButton } from "@/components/understood-button";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; subject: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, subject, slug } = await params;
  const material = getMaterial(subject, slug);
  if (!material) return {};
  return pageMetadata({
    locale,
    path: `/materials/${subject}/${slug}`,
    title: material.title,
    description: material.summary,
    ogType: "article",
    article: { section: material.subject },
  });
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

  // Chapter sidebar, in syllabus order (R1). Practical sections carry no
  // linkable topics, so only sections with topics appear.
  const navSections: MaterialNavSection[] = coverage.sections
    .filter((entry) => entry.topics.length > 0)
    .map((entry) => ({
      id: entry.section.id,
      name: localize(entry.section.name, locale),
      topics: entry.topics.map((topicEntry) => ({
        id: topicEntry.topic.id,
        name: localize(topicEntry.topic.name, locale),
        href: topicEntry.material
          ? `/materials/${topicEntry.material.subject}/${topicEntry.material.slug}`
          : null,
        current: topicEntry.topic.id === material.topic,
      })),
    }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <aside className="mb-6 lg:mb-0">
        <MaterialNav
          sections={navSections}
          labels={{
            heading: t("chapters"),
            toggle: t("chaptersToggle"),
            comingSoon: t("comingSoon"),
          }}
        />
      </aside>
      <article className="min-w-0 max-w-3xl">
        <JsonLd
          data={breadcrumbJsonLd(locale, [
            { name: t("title"), path: "/materials" },
            { name: material.title },
          ])}
        />
        <Link href="/materials" className="label-code hover:text-foreground">
          ← {t("backToMaterials")}
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="label-code rounded bg-muted px-2 py-0.5 text-brand">
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
        <p className="mt-2 text-lg text-foreground/75">{material.summary}</p>
        <UnderstoodButton kind="material" subject={material.subject} slug={material.slug} />

        <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
          <MaterialMDX code={material.body} vizConfig={material.vizConfig} />
        </div>

        {related.length > 0 && (
          <section className="mt-10 border-t border-border pt-6">
            <h2 className="heading-section mb-3">{t("relatedEditorials")}</h2>
            <ul className="space-y-2">
              {related.map((editorial) => (
                <li key={editorial.slug}>
                  <Link
                    href={`/archive/${editorial.subject}/${editorial.slug}`}
                    className="text-cherenkov-blue-800 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
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
    </div>
  );
}
