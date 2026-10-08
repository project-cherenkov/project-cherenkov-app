import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { getAllEditorials, getEditorial } from "@/lib/content";
import { EditorialMDX } from "@/components/editorial-mdx";
import { JsonLd } from "@/components/seo/json-ld";
import { articleJsonLd, breadcrumbJsonLd, isIndexableEditorial } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";
// Imported here, not in app/globals.css — KaTeX's CSS should only ship to
// pages that actually render math (Non-Functional Requirements §8).
import "katex/dist/katex.min.css";

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
  const editorial = getEditorial(subject, slug);
  if (!editorial) return {};
  return pageMetadata({
    locale,
    path: `/archive/${subject}/${slug}`,
    title: editorial.title,
    description: editorial.hook,
    ogType: "article",
    // Implementation fixtures and placeholder-author stubs stay out of search
    // even once the rest of the site is opened up.
    noindex: !isIndexableEditorial(editorial),
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
  const editorial = getEditorial(subject, slug);
  if (!editorial) notFound();

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
              { name: editorial.title },
            ]),
            articleJsonLd({
              locale,
              path: `/archive/${subject}/${slug}`,
              headline: editorial.title,
              description: editorial.hook,
              author: editorial.author,
              publishedAt: editorial.publishedAt,
              keywords: editorial.tags,
              section: editorial.subject,
              siteName: tSite("name"),
            }),
          ]}
        />
      )}
      <Link href="/archive" className="label-code hover:text-slate-700 dark:hover:text-slate-200">
        ← {t("backToArchive")}
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="label-code rounded bg-slate-100 px-2 py-0.5 text-cherenkov-blue-800 dark:bg-slate-800 dark:text-cherenkov-blue-pastel">
          {editorial.subject}
        </span>
        <span className="label-code">
          {t("principleLabel")}: {editorial.principle}
        </span>
        {editorial.errorType && (
          <span className="label-code">
            {t("errorTypeLabel")}: {editorial.errorType}
          </span>
        )}
      </div>

      <h1 className="mt-3 text-3xl font-bold text-foreground">
        {editorial.title}
      </h1>
      <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">{editorial.hook}</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        {t("byAuthor", { author: editorial.author })}
      </p>

      <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
        {/* EditorialMDX itself decides whether to also render the "forgot
            the tag" visualization fallback, based on the actual rendered
            body — see components/editorial-mdx.tsx (F-05). */}
        <EditorialMDX
          code={editorial.body}
          vizConfig={editorial.vizConfig}
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-1.5 border-t border-slate-200 pt-6">
        <span className="label-code mr-1">{t("sections.tags")}:</span>
        {editorial.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-cherenkov-pink/40 px-2.5 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-200"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
