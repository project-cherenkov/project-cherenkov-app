import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocMDX } from "@/components/docs/doc-mdx";
import { JsonLd } from "@/components/seo/json-ld";
import { Link } from "@/i18n/routing";
import { DOCS_SOURCE_LOCALE } from "@/lib/docs-core";
import { getAllDocSlugs, getDocLocales, getDocNeighbours, getDocPage } from "@/lib/docs";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";
// Docs can contain math, same as editorials; loaded only on these pages.
import "katex/dist/katex.min.css";

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = getDocPage(locale, slug);
  if (!page) return {};
  const { doc, isFallback } = page;
  return pageMetadata({
    locale,
    path: `/docs/${slug}`,
    title: doc.title,
    description: doc.description,
    ogType: "article",
    // A fallback page is the English text under another locale's URL: don't
    // index it as a duplicate, and point search engines at the real one.
    noindex: isFallback,
    canonicalLocale: isFallback ? DOCS_SOURCE_LOCALE : locale,
    availableLocales: getDocLocales(slug),
    article: {
      modifiedTime: doc.updatedAt,
      section: doc.section,
    },
  });
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = getDocPage(locale, slug);
  if (!page) notFound();

  const { doc, isFallback } = page;
  const t = await getTranslations("docs");
  const tSite = await getTranslations("site");
  const { previous, next } = getDocNeighbours(locale, slug);
  const updated = doc.updatedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(doc.updatedAt))
    : null;

  return (
    <article>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, [
            { name: t("title"), path: "/docs" },
            { name: doc.title },
          ]),
          articleJsonLd({
            locale: doc.locale,
            path: `/docs/${slug}`,
            headline: doc.title,
            description: doc.description,
            author: tSite("name"),
            publishedAt: doc.updatedAt ?? "2026-10-07",
            siteName: tSite("name"),
            type: "TechArticle",
            authorType: "Organization",
          }),
        ]}
      />

      <nav aria-label={t("breadcrumb")} className="label-code">
        <Link href="/docs" className="underline-offset-4 hover:underline">
          {t("title")}
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{doc.title}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-foreground">{doc.title}</h1>
      <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">{doc.description}</p>
      {updated && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("updated", { date: updated })}</p>}

      {isFallback && (
        <p
          role="note"
          className="mt-4 rounded-md border border-dashed border-cherenkov-pink-pastel bg-cherenkov-pink/20 p-3 text-sm text-slate-700 dark:text-slate-200"
        >
          {t("fallbackNotice")}
        </p>
      )}

      {doc.toc.length > 1 && (
        <nav aria-label={t("onThisPage")} className="mt-6 rounded-md border border-border bg-card p-4">
          <p className="label-code mb-2">{t("onThisPage")}</p>
          <ul className="space-y-1 text-sm">
            {doc.toc.map((entry) => (
              <li key={entry.id} className={entry.depth === 3 ? "ml-4" : undefined}>
                <a
                  href={`#${entry.id}`}
                  className="inline-flex min-h-8 items-center text-slate-700 underline-offset-4 hover:underline dark:text-slate-200"
                >
                  {entry.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* When English is shown under another locale, say so to assistive tech
          and translation tools (WCAG 3.1.2 Language of Parts). */}
      <div
        lang={isFallback ? doc.locale : undefined}
        className="prose prose-slate mt-8 max-w-none dark:prose-invert prose-a:text-cherenkov-blue-800 dark:prose-a:text-cherenkov-blue-pastel prose-headings:scroll-mt-24 prose-code:before:content-none prose-code:after:content-none"
      >
        <DocMDX code={doc.body} />
      </div>

      <nav
        aria-label={t("pager")}
        className="mt-12 flex flex-wrap justify-between gap-4 border-t border-border pt-6"
      >
        {previous ? (
          <Link
            href={`/docs/${previous.doc.slug}`}
            rel="prev"
            className="flex min-h-11 flex-col rounded-md border border-border px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="label-code">← {t("previous")}</span>
            <span className="font-medium text-foreground">{previous.doc.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={`/docs/${next.doc.slug}`}
            rel="next"
            className="flex min-h-11 flex-col rounded-md border border-border px-4 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="label-code">{t("next")} →</span>
            <span className="font-medium text-foreground">{next.doc.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
