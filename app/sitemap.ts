import type { MetadataRoute } from "next";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { getAllDocSlugs, getDocLocales, getDocPage } from "@/lib/docs";
import { routing } from "@/i18n/routing";
import { SUBJECTS } from "@/lib/subjects";
import { isIndexableEditorial, languageAlternates, localizedUrl } from "@/lib/seo";

// DEPLOYMENT-READINESS ADDITION, not part of the original spec — no
// sitemap existed at all. Generated from the same Velite-backed content
// query every page already uses (lib/content.ts), so it can never drift
// out of sync with what's actually published; nothing here is hand-
// maintained. Every locale in i18n/routing.ts gets its own entry per page
// (next-intl's default localePrefix is "always" — see that file's
// comment — so /id/... and /en/... are both real, distinct URLs).
//
// SEO pass: each entry now also lists its hreflang alternates (including
// x-default), so search engines can pair /id/x with /en/x without having to
// guess. Docs are only listed in languages where a real translation exists —
// the English fallback shown under /id/docs/* is noindex and canonicalises to
// English, so it doesn't belong here — and editorial fixtures are left out.
const STATIC_PATHS = [
  "",
  "/archive",
  "/syllabus",
  ...SUBJECTS.map((subject) => `/syllabus/${subject}`),
  "/materials",
  "/docs",
  "/about",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const editorials = getAllEditorials().filter(isIndexableEditorial);
  const materials = getAllMaterials();
  const entries: MetadataRoute.Sitemap = [];

  const add = (
    path: string,
    locales: readonly string[],
    extra: Partial<MetadataRoute.Sitemap[number]> = {},
  ) => {
    const languages = languageAlternates(path, locales);
    for (const locale of locales) {
      entries.push({
        url: localizedUrl(locale, path),
        alternates: { languages },
        ...extra,
      });
    }
  };

  for (const path of STATIC_PATHS) {
    add(path, routing.locales, { changeFrequency: path === "" ? "weekly" : "monthly" });
  }
  for (const editorial of editorials) {
    add(`/archive/${editorial.subject}/${editorial.slug}`, routing.locales, {
      lastModified: new Date(editorial.publishedAt),
      changeFrequency: "yearly",
    });
  }
  for (const material of materials) {
    add(`/materials/${material.subject}/${material.slug}`, routing.locales, {
      changeFrequency: "monthly",
    });
  }
  for (const slug of getAllDocSlugs()) {
    const locales = getDocLocales(slug);
    const page = getDocPage("en", slug);
    add(`/docs/${slug}`, locales, {
      ...(page?.doc.updatedAt ? { lastModified: new Date(page.doc.updatedAt) } : {}),
      changeFrequency: "monthly",
    });
  }

  return entries;
}
