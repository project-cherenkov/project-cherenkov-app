import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocMDX } from "@/components/docs/doc-mdx";
import { JsonLd } from "@/components/seo/json-ld";
import { TranslationNotice } from "@/components/site/translation-notice";
import { breadcrumbJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";
import { getUpdates } from "@/lib/updates";
import "katex/dist/katex.min.css";
import { UpdatesReadMarker } from "@/components/site/updates-read-marker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "updates" });
  return pageMetadata({
    locale,
    path: "/updates",
    title: t("title"),
    description: t("description"),
  });
}

export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("updates");
  const tSite = await getTranslations("site");
  const tEditorial = await getTranslations("editorial");
  const entries = getUpdates(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: t("title") }])} />
      <UpdatesReadMarker latestUpdateDate={entries[0]?.date} />
      <p className="label-code" aria-hidden="true">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-foreground/75">{t("description")}</p>
      <p className="mt-2 text-sm">
        <a href="/updates/feed.xml" className="underline underline-offset-2 hover:text-foreground">
          {t("feed")}
        </a>
      </p>

      {entries.length === 0 ? (
        <p className="mt-8 text-foreground/75">{t("empty")}</p>
      ) : (
        <ol className="mt-8 space-y-10">
          {entries.map(({ update, date: published, type, author, isFallback, pinned }) => (
            <li key={update.slug} id={update.slug} lang={update.locale} className="border-t border-border pt-8 first:border-t-0 first:pt-0">
              <article>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="label-code rounded bg-muted px-2 py-0.5 text-foreground/80">
                    {t(`types.${type}`)}
                  </span>
                  <time dateTime={published} className="label-code">
                    {date.format(new Date(published.includes("T") ? published : `${published}T00:00:00Z`))}
                  </time>
                  {pinned && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded bg-cherenkov-pink-100 px-2 py-0.5 text-xs font-medium text-cherenkov-pink-800 dark:bg-cherenkov-pink-900/40 dark:text-cherenkov-pink-300">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-3 w-3"
                        aria-hidden="true"
                      >
                        <path d="M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5l-2 3h10l-2-3Zm-4 9a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm0 3a1 1 0 0 0 1-1h-2a1 1 0 0 0 1 1Z" />
                      </svg>
                      {t("pinned")}
                    </span>
                  )}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">{update.title}</h2>
                {author && <p className="mt-1 text-sm text-foreground/70">{tEditorial("byAuthor", { author })}</p>}
                {/* Shown per entry, and only while this entry has no version in
                    the reader's language: adding the translation file removes it. */}
                {isFallback && (
                  <TranslationNotice
                    message={tSite("translationNotice", {
                      requestedLanguage: tSite(`languageNames.${locale}`),
                      displayedLanguage: tSite(`languageNames.${update.locale}`),
                    })}
                  />
                )}
                <div className="prose prose-slate mt-3 max-w-none dark:prose-invert">
                  <DocMDX code={update.body} />
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
