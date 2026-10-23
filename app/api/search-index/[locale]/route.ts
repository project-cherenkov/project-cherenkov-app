import { NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { getDocPages } from "@/lib/docs";
import { buildSearchIndex } from "@/lib/search";
import { getAllSyllabi } from "@/lib/syllabus";

// The site-search index for one locale (R6), built at BUILD time from the same
// content the pages render and served as a static JSON file. The browser
// downloads it the first time the search box opens and scores locally, so
// typed queries never reach a server. Lives under /api so the locale
// middleware leaves the path alone (middleware.ts).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const index = buildSearchIndex(
    {
      // Implementation fixtures (tagged "fixture") are not content a reader
      // should be sent to, same rule as the sitemap's.
      editorials: getAllEditorials().filter((e) => !e.tags.includes("fixture")),
      materials: getAllMaterials(),
      docs: getDocPages(locale).map(({ doc }) => ({
        slug: doc.slug,
        title: doc.title,
        description: doc.description,
      })),
      syllabi: getAllSyllabi(),
    },
    locale,
  );
  return NextResponse.json(index);
}
