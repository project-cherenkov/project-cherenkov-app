import type { MetadataRoute } from "next";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { routing } from "@/i18n/routing";
import { SUBJECTS } from "@/lib/subjects";
import { siteUrl } from "@/lib/site";

// DEPLOYMENT-READINESS ADDITION, not part of the original spec — no
// sitemap existed at all. Generated from the same Velite-backed content
// query every page already uses (lib/content.ts), so it can never drift
// out of sync with what's actually published; nothing here is hand-
// maintained. Every locale in i18n/routing.ts gets its own entry per page
// (next-intl's default localePrefix is "always" — see that file's
// comment — so /id/... and /en/... are both real, distinct URLs).
const STATIC_PATHS = [
  "",
  "/archive",
  "/syllabus",
  ...SUBJECTS.map((subject) => `/syllabus/${subject}`),
  "/materials",
  "/about",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const editorials = getAllEditorials();
  const materials = getAllMaterials();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${siteUrl}/${locale}${path}`,
        changeFrequency: path === "" ? "weekly" : "monthly",
      });
    }
    for (const editorial of editorials) {
      entries.push({
        url: `${siteUrl}/${locale}/archive/${editorial.subject}/${editorial.slug}`,
        lastModified: new Date(editorial.publishedAt),
        changeFrequency: "yearly",
      });
    }
    for (const material of materials) {
      entries.push({
        url: `${siteUrl}/${locale}/materials/${material.subject}/${material.slug}`,
        changeFrequency: "monthly",
      });
    }
  }

  return entries;
}
