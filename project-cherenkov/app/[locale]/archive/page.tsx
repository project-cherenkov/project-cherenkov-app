import { getTranslations } from "next-intl/server";

import { ArchiveFilters } from "@/components/site/archive-filters";
import { EditorialCard } from "@/components/site/editorial-card";
import { filterEditorials, getArchiveFacets } from "@/lib/content";

interface ArchiveSearchParams {
  subject?: string;
  principle?: string;
  errorType?: string;
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<ArchiveSearchParams>;
}) {
  const params = await searchParams;
  const t = await getTranslations("archive");
  const facets = getArchiveFacets();
  const results = filterEditorials(params);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("title")}</h1>
      <p className="mt-2 text-slate-600">{t("description")}</p>

      <div className="mt-6">
        <ArchiveFilters
          subjects={facets.subjects}
          principles={facets.principles}
          errorTypes={facets.errorTypes}
        />
      </div>

      <p className="mt-4 label-code">{t("count", { count: results.length })}</p>

      {results.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((editorial) => (
            <EditorialCard
              key={`${editorial.subject}-${editorial.slug}`}
              editorial={editorial}
            />
          ))}
        </div>
      )}
    </div>
  );
}
