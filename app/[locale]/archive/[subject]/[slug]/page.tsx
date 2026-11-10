import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { getAllEditorials, getEditorial, isDraftEditorial, resolveEditorialText } from "@/lib/content";
import { isEditorRequest } from "@/lib/editor-access";
import { EditorialMDX } from "@/components/editorial-mdx";
import { PracticeLinks } from "@/components/site/practice-links";
import { TranslationNotice } from "@/components/site/translation-notice";
import { UnderstoodButton } from "@/components/understood-button";
import { JsonLd } from "@/components/seo/json-ld";
import { articleJsonLd, breadcrumbJsonLd, isIndexableEditorial } from "@/lib/seo";
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
    canonicalLocale: isFallback ? text.locale : locale,
    availableLocales: locales,
    article: {
      publishedTime: editorial.publishedAt,
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

  const t = await getTranslations("editorial");
  const tSite = await getTranslations("site");
  const tArchive = await getTranslations("archive");

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {isIndexableEditorial(editorial) && (
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
              keywords: editorial.tags,
              section: editorial.subject,
              siteName: tSite("name"),
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
        <span className="label-code rounded bg-muted px-2 py-0.5 text-brand">
          {editorial.subject}
        </span>
        {/* The values are kebab-case identifiers; shown in capitals they ran
            to 44 characters and broke across lines mid-word on a phone. The
            label stays in the mono-caps voice, the value is plain and may
            wrap anywhere, and each pair gets its own line below sm. */}
        <span className="label-code w-full sm:w-auto">
          {t("principleLabel")}:{" "}
          <span className="normal-case tracking-normal text-foreground/80 [overflow-wrap:anywhere]">
            {editorial.principle}
          </span>
        </span>
        {editorial.errorType && (
          <span className="label-code w-full sm:w-auto">
            {t("errorTypeLabel")}:{" "}
            <span className="normal-case tracking-normal text-foreground/80 [overflow-wrap:anywhere]">
              {editorial.errorType}
            </span>
          </span>
        )}
      </div>
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
      <p className="mt-1 text-xs text-muted-foreground">
        {t("byAuthor", { author: editorial.author })}
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
        />
      </div>

      <PracticeLinks links={editorial.practiceLinks} />

      <div className="mt-10 flex flex-wrap gap-1.5 border-t border-border pt-6">
        <span className="label-code mr-1">{t("sections.tags")}:</span>
        {editorial.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-cherenkov-pink/40 px-2.5 py-0.5 font-mono text-xs text-foreground/80"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
