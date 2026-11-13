import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { humanizeSlug } from "@/lib/utils";
import { getAllEditorials, getEditorial, isDraftEditorial, resolveEditorialText } from "@/lib/content";
import { isEditorRequest } from "@/lib/editor-access";
import { EditorialMDX } from "@/components/editorial-mdx";
import { EditorialCard } from "@/components/site/editorial-card";
import { PracticeLinks } from "@/components/site/practice-links";
import { TranslationNotice } from "@/components/site/translation-notice";
import { UnderstoodButton } from "@/components/understood-button";
import { JsonLd } from "@/components/seo/json-ld";
import {
  OG_IMAGE_VERSION,
  articleJsonLd,
  breadcrumbJsonLd,
  isIndexableEditorial,
  localizedUrl,
} from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";
// Imported here, not in app/globals.css — KaTeX's CSS should only ship to
// pages that actually render math (Non-Functional Requirements §8).
import "katex/dist/katex.min.css";

// Published editorials resolve for everyone. An draft one resolves only for
// an editor; for anyone else it is indistinguishable from a page that does not
// exist. The editor check (which reads the session, making the request
// dynamic) runs only when the item is a draft, so published pages stay
// statically generated.
async function resolveEditorial(subject: string, slug: string) {
  const published = getEditorial(subject, slug);
  if (published) return published;
  if (!isDraftEditorial(subject, slug)) return undefined;
  if (!(await isEditorRequest())) return undefined;
  return getEditorial(subject, slug, { includeDrafts: true });
}

// Only published editorials are prerendered; draft ones render on demand.
export function generateStaticParams() {
  return getAllEditorials().map((editorial) => ({
    subject: editorial.subject,
    slug: editorial.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; subject: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, subject, slug } = await params;
  // Draft: never expose its title/description in metadata (this runs for
  // every visitor, editor or not) and keep it out of search either way.
  if (isDraftEditorial(subject, slug)) {
    return { robots: { index: false, follow: false } };
  }
  const editorial = getEditorial(subject, slug);
  if (!editorial) return {};
  const { text, isFallback, locales } = resolveEditorialText(editorial, locale);
  return pageMetadata({
    locale,
    path: `/archive/${subject}/${slug}`,
    title: text.title,
    description: text.hook,
    ogType: "article",
    // A fallback is the original's text under another language's URL: keep it
    // out of search and point at the real page. Implementation fixtures and
    // placeholder-author stubs stay out of search even once the rest is open.
    noindex: isFallback || !isIndexableEditorial(editorial),
    followLinks: isFallback,
    // Pages that pass an explicit og:image must name their own card, or they
    // share the site-wide one (see buildPageMetadata).
    imagePath: `/archive/${subject}/${slug}/opengraph-image`,
    canonicalLocale: isFallback ? text.locale : locale,
    availableLocales: locales,
    article: {
      publishedTime: editorial.publishedAt,
      modifiedTime: editorial.updatedAt ?? editorial.publishedAt,
      authors: [editorial.author],
      tags: editorial.tags,
      section: editorial.subject,
    },
  });
}

export default async function EditorialPage({
  params,
}: {
  params: Promise<{ locale: string; subject: string; slug: string }>;
}) {
  const { locale, subject, slug } = await params;
  setRequestLocale(locale);
  const editorial = await resolveEditorial(subject, slug);
  if (!editorial) notFound();
  const draft = editorial.status === "draft";
  // The visitor's language where a translation exists, else the original.
  const { text, isFallback } = resolveEditorialText(editorial, locale);

  // Other editorials that share the principle or the error type first, then
  // the same subject; two at most. Only published ones (the default list).
  const related = getAllEditorials()
    .filter((other) => !(other.subject === subject && other.slug === slug))
    .map((other) => ({
      other,
      score:
        (other.principle === editorial.principle ? 4 : 0) +
        (editorial.errorType && other.errorType === editorial.errorType ? 3 : 0) +
        (other.subject === editorial.subject ? 1 : 0) +
        other.tags.filter((tag) => editorial.tags.includes(tag)).length * 0.5,
    }))
    .filter(({ score }) => score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 2)
    .map(({ other }) => other);

  const t = await getTranslations("editorial");
  const tSite = await getTranslations("site");
  const tArchive = await getTranslations("archive");
  const tSyllabus = await getTranslations("syllabus");

  return (
    <article lang={text.locale} className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {isIndexableEditorial(editorial) && !isFallback && (
        <JsonLd
          data={[
            breadcrumbJsonLd(locale, [
              { name: tArchive("title"), path: "/archive" },
              { name: text.title },
            ]),
            articleJsonLd({
              locale,
              path: `/archive/${subject}/${slug}`,
              headline: text.title,
              description: text.hook,
              author: editorial.author,
              publishedAt: editorial.publishedAt,
              modifiedAt: editorial.updatedAt ?? editorial.publishedAt,
              keywords: editorial.tags,
              section: tSyllabus(`subjects.${editorial.subject}`),
              siteName: tSite("name"),
              textLanguage: text.locale,
              image: `${localizedUrl(locale, `/archive/${subject}/${slug}/opengraph-image`)}?v=${OG_IMAGE_VERSION}`,
              authorUrl: localizedUrl(locale, "/about"),
            }),
          ]}
        />
      )}
      <Link href="/archive" className="label-code inline-flex min-h-11 items-center hover:text-foreground">
        ← {t("backToArchive")}
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
        <Link
          href={`/archive?subject=${encodeURIComponent(editorial.subject)}`}
          className="label-code inline-flex min-h-6 items-center rounded bg-muted px-2 py-0.5 text-brand hover:underline"
        >
          {tSyllabus(`subjects.${editorial.subject}`)}
        </Link>
      </div>
      {/* Principle and error type are the site's filing system ("filed by the
          mistake it corrects"), so each gets its own labelled line in plain
          sentence case and links to every editorial that shares it. */}
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
        <dt className="label-code self-baseline">{t("principleLabel")}</dt>
        <dd className="m-0 self-baseline [overflow-wrap:anywhere]">
          <Link
            href={`/archive?principle=${encodeURIComponent(editorial.principle)}`}
            className="text-foreground underline underline-offset-4 hover:text-brand"
            title={t("filterByPrinciple")}
          >
            {humanizeSlug(editorial.principle)}
          </Link>
        </dd>
        {editorial.errorType && (
          <>
            <dt className="label-code self-baseline">{t("errorTypeLabel")}</dt>
            <dd className="m-0 self-baseline [overflow-wrap:anywhere]">
              <Link
                href={`/archive?errorType=${encodeURIComponent(editorial.errorType)}`}
                className="text-foreground underline underline-offset-4 hover:text-brand"
                title={t("filterByErrorType")}
              >
                {humanizeSlug(editorial.errorType)}
              </Link>
            </dd>
          </>
        )}
      </dl>
      <p className="label-code mt-2">
        {t("lastUpdatedLabel")}:{" "}
        {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
          new Date(editorial.updatedAt ?? editorial.publishedAt),
        )}
      </p>

      <h1 className="mt-3 text-3xl font-bold text-foreground">
        {text.title}
      </h1>
      <p className="mt-2 text-lg text-foreground/75">{text.hook}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.rich("byAuthorLink", {
          author: editorial.author,
          link: (chunks) => (
            <Link href="/about#team" className="underline underline-offset-4 hover:text-foreground">
              {chunks}
            </Link>
          ),
        })}
      </p>

      {/* Progress is only recorded for published pages (the study-session
          action validates against the public list), so draft pages omit it. */}
      {!draft && (
        <UnderstoodButton kind="editorial" subject={editorial.subject} slug={editorial.slug} />
      )}

      <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
        {/* EditorialMDX itself decides whether to also render the "forgot
            the tag" visualization fallback, based on the actual rendered
            body — see components/editorial-mdx.tsx (F-05). */}
        <EditorialMDX
          code={text.body}
          vizConfig={editorial.vizConfig}
          // The caption is written in the original's language, so it is not
          // shown beside a translated body.
          vizDescription={text.locale === editorial.language ? editorial.vizDescription : undefined}
        />
      </div>

      <PracticeLinks links={editorial.practiceLinks} />

      <div className="mt-10 flex flex-wrap gap-1.5 border-t border-border pt-6">
        <span className="label-code mr-1">{t("sections.tags")}:</span>
        {editorial.tags.map((tag) => (
          <Link
            key={tag}
            href={`/archive?tag=${encodeURIComponent(tag)}`}
            title={t("filterByTag", { tag })}
            className="inline-flex min-h-6 items-center rounded-full bg-cherenkov-pink/40 px-2.5 py-0.5 font-mono text-xs text-foreground/80 hover:underline"
          >
            {tag}
          </Link>
        ))}
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-10 border-t border-border pt-6">
          <h2 id="related-heading" className="heading-section">
            {t("relatedHeading")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <EditorialCard key={`${item.subject}-${item.slug}`} editorial={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
