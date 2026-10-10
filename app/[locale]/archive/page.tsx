import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ArchiveFilters } from "@/components/site/archive-filters";
import { EditorialCard } from "@/components/site/editorial-card";
import { filterEditorials, getArchiveFacets } from "@/lib/content";
import { pageMetadata } from "@/lib/seo-metadata";

interface ArchiveSearchParams {
  subject?: string;
  principle?: string;
  errorType?: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "archive" });
  // Always canonical to the unfiltered archive: ?subject=…&principle=… views
  // are the same page re-sorted, and shouldn't compete with it in search.
  return pageMetadata({
    locale,
    path: "/archive",
    title: t("title"),
    description: t("description"),
  });
}

export default async function ArchivePage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ArchiveSearchParams>;
}) {
  const { locale } = await routeParams;
  setRequestLocale(locale);
  const params = await searchParams;
  const t = await getTranslations("archive");
  const facets = getArchiveFacets(params);
  const results = filterEditorials(params);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{t("description")}</p>

      <div className="mt-6">
        <Suspense>
          <ArchiveFilters
            subjects={facets.subjects}
            principles={facets.principles}
            errorTypes={facets.errorTypes}
          />
        </Suspense>
      </div>

      <p className="mt-4 label-code">{t("count", { count: results.length })}</p>

      {results.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((editorial) => (
            <EditorialCard
              headingLevel={2}
              key={`${editorial.subject}-${editorial.slug}`}
              editorial={editorial}
            />
          ))}
        </div>
      )}
    </div>
  );
}
