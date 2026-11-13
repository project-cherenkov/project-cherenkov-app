import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MaterialMDX } from "@/components/material-mdx";
import { MaterialNav, type MaterialNavSection } from "@/components/site/material-nav";
import { TranslationNotice } from "@/components/site/translation-notice";
import { UnderstoodButton } from "@/components/understood-button";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";
import { Link } from "@/i18n/routing";
import { getAllEditorials, getAllMaterials, getMaterial, isDraftMaterial, resolveMaterialText } from "@/lib/content";
import { isEditorRequest } from "@/lib/editor-access";
import { buildSubjectCoverage, findCoverageEntry, getSectionNeighbours } from "@/lib/library";
import { getSyllabus, getTopicLocation, localize, topicAnchor } from "@/lib/syllabus";
// Imported here, not globally — KaTeX's CSS only ships to pages that render
// math (Non-Functional Requirements §8), same as the editorial page.
import "katex/dist/katex.min.css";

// Same rule as editorials: published materials resolve for everyone, an
// draft one only for an editor, and the session is read only when the
// material is a draft so published pages stay statically generated.
async function resolveMaterial(subject: string, slug: string) {
  const published = getMaterial(subject, slug);
  if (published) return published;
  if (!isDraftMaterial(subject, slug)) return undefined;
  if (!(await isEditorRequest())) return undefined;
  return getMaterial(subject, slug, { includeDrafts: true });
}

// Only published materials are prerendered; draft ones render on demand.
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
  // Draft: no title/description in metadata (this runs for every visitor)
  // and never indexed.
  if (isDraftMaterial(subject, slug)) {
    return { robots: { index: false, follow: false } };
  }
  const material = getMaterial(subject, slug);
  if (!material) return {};
  const { text, isFallback, locales } = resolveMaterialText(material, locale);
  return pageMetadata({
    locale,
    path: `/materials/${subject}/${slug}`,
    title: text.title,
    description: text.summary,
    ogType: "article",
    noindex: isFallback,
    followLinks: isFallback,
    canonicalLocale: isFallback ? text.locale : locale,
    availableLocales: locales,
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
  const material = await resolveMaterial(subject, slug);
  const syllabus = getSyllabus(subject);
  if (!material || !syllabus) notFound();
  const draft = material.status === "draft";
  // The visitor's language where a translation exists, else the original.
  const { text, isFallback } = resolveMaterialText(material, locale);

  const t = await getTranslations("materials");
  const tSite = await getTranslations("site");
  const ts = await getTranslations("syllabus");
  const location = getTopicLocation(subject, material.topic);
  const coverage = buildSubjectCoverage(syllabus, getAllMaterials(), getAllEditorials());
  // `material.topic` may name a topic or one of its subtopics. Editorials
  // listed under a material are the ones attached to that exact id.
  const match = findCoverageEntry(coverage, material.topic);
  const related = match?.subtopic?.editorials ?? match?.topic.editorials ?? [];
  const { previous, next } = getSectionNeighbours(coverage, material.topic);

  // Chapter sidebar, in syllabus order (R1). Practical sections carry no
  // linkable topics, so only sections with topics appear. Subtopics nest
  // under their topic.
  const hrefOf = (entry: { material?: { subject: string; slug: string } }) =>
    entry.material ? `/materials/${entry.material.subject}/${entry.material.slug}` : null;
  const navSections: MaterialNavSection[] = coverage.sections
    .filter((entry) => entry.topics.length > 0)
    .map((entry) => ({
      id: entry.section.id,
      name: localize(entry.section.name, locale),
      topics: entry.topics.map((topicEntry) => ({
        id: topicEntry.topic.id,
        name: localize(topicEntry.topic.name, locale),
        href: hrefOf(topicEntry),
        current: topicEntry.topic.id === material.topic,
        subtopics: topicEntry.subtopics.map((subEntry) => ({
          id: subEntry.subtopic.id,
          name: localize(subEntry.subtopic.name, locale),
          href: hrefOf(subEntry),
          current: subEntry.subtopic.id === material.topic,
        })),
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
      <article lang={text.locale} className="min-w-0 max-w-3xl">
        <JsonLd
          data={breadcrumbJsonLd(locale, [
            { name: t("title"), path: "/materials" },
            { name: text.title },
          ])}
        />
        <Link href="/materials" className="label-code inline-flex min-h-11 items-center hover:text-foreground">
          ← {t("backToMaterials")}
        </Link>

        {isFallback && (
          <TranslationNotice
            message={tSite("translationNotice", {
              requestedLanguage: tSite(`languageNames.${locale}`),
              displayedLanguage: tSite(`languageNames.${text.locale}`),
            })}
          />
        )}

        {draft && (
          <p
            role="note"
            className="mt-4 rounded-md border border-border-strong bg-muted px-3 py-2 text-sm text-foreground"
          >
            <span className="label-code mr-2">{t("draftBadge")}</span>
            {t("draftNotice")}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="label-code rounded bg-muted px-2 py-0.5 text-brand">
            {ts(`subjects.${subject}`)}
          </span>
          {location && (
            <Link
              href={`/syllabus/${subject}#${topicAnchor((location.subtopic ?? location.topic).id)}`}
              className="label-code underline-offset-4 hover:underline"
            >
              {t("inSyllabus")}: {localize(location.section.name, locale)} › {localize(location.topic.name, locale)}
              {location.subtopic ? ` › ${localize(location.subtopic.name, locale)}` : ""}
            </Link>
          )}
        </div>

        <h1 className="mt-3 text-3xl font-bold text-foreground">{text.title}</h1>
        <p className="mt-2 text-lg text-foreground/75">{text.summary}</p>
        {!draft && (
          <UnderstoodButton kind="material" subject={material.subject} slug={material.slug} />
        )}

        <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
          <MaterialMDX code={text.body} vizConfig={material.vizConfig} />
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
