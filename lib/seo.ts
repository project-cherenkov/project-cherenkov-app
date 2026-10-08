// Pure SEO helpers: URL building, hreflang alternates, the indexing switch,
// metadata assembly and JSON-LD builders. Deliberately free of any next-intl
// server import so every function here is unit-testable (lib/seo.test.ts);
// the async wrapper that fetches translations lives in lib/seo-metadata.ts.
import type { Metadata } from "next";

import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export const LOCALES = routing.locales;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = routing.defaultLocale;

// OpenGraph wants language_TERRITORY ("id_ID"), not the bare "id"/"en" that
// next-intl uses for routing.
export const OG_LOCALES: Record<AppLocale, string> = {
  id: "id_ID",
  en: "en_US",
};

export const REPO_URL = "https://github.com/project-cherenkov/project-cherenkov-app";

export function isAppLocale(value: string): value is AppLocale {
  return (LOCALES as readonly string[]).includes(value);
}

// --- Indexing switch ---------------------------------------------------------
//
// The whole site has been noindex since launch (see app/[locale]/layout.tsx's
// history: placeholder copy would have been indexed verbatim). That safe
// default is preserved: nothing becomes indexable until NEXT_PUBLIC_ALLOW_INDEXING
// is set to "1" (or "true"). Account/auth/planner/admin pages are noindex
// regardless — see `noindex` on buildPageMetadata().
export function isIndexingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const value = env.NEXT_PUBLIC_ALLOW_INDEXING?.trim().toLowerCase();
  return value === "1" || value === "true";
}

export function robotsFor(options: { noindex?: boolean } = {}): NonNullable<Metadata["robots"]> {
  const index = isIndexingEnabled() && !options.noindex;
  return { index, follow: index };
}

// --- URLs --------------------------------------------------------------------

/** "/archive" + "id" → "/id/archive"; "/" + "id" → "/id". */
export function localizedPath(locale: string, path: string): string {
  const clean = path === "/" || path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

export function localizedUrl(locale: string, path: string): string {
  return `${siteUrl}${localizedPath(locale, path)}`;
}

/**
 * hreflang map for one page. `x-default` points at the default locale, which
 * is what Google documents for "no better match for this visitor's language".
 * `locales` lets a page advertise only the languages it genuinely exists in
 * (the docs do this while translations are pending).
 */
export function languageAlternates(
  path: string,
  locales: readonly string[] = LOCALES,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const locale of locales) map[locale] = localizedUrl(locale, path);
  const fallback = locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0];
  if (fallback) map["x-default"] = localizedUrl(fallback, path);
  return map;
}

// --- Text --------------------------------------------------------------------

/** Trim to a meta-description-friendly length on a word boundary. */
export function truncate(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.\-—–]+$/u, "")}…`;
}

// --- Page metadata -------------------------------------------------------------

export interface PageMetaInput {
  locale: string;
  /** Path WITHOUT the locale prefix. "/" for the home page. */
  path: string;
  title: string;
  description: string;
  siteName: string;
  /** Use `title` as-is instead of the layout's "%s — Site" template. */
  absoluteTitle?: boolean;
  ogType?: "website" | "article";
  /** Force noindex regardless of the site-wide switch (auth, account, planner…). */
  noindex?: boolean;
  /** Locales this page genuinely exists in. Defaults to every locale. */
  availableLocales?: readonly string[];
  /** Which locale's URL is canonical. Defaults to `locale`. */
  canonicalLocale?: string;
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    authors?: string[];
    tags?: string[];
    section?: string;
  };
}

export function buildPageMetadata(input: PageMetaInput): Metadata {
  const {
    locale,
    path,
    title,
    siteName,
    absoluteTitle = false,
    ogType = "website",
    noindex = false,
    availableLocales = LOCALES,
    canonicalLocale = locale,
    article,
  } = input;
  const description = truncate(input.description, 200);
  const fullTitle = absoluteTitle ? title : `${title} — ${siteName}`;
  const canonical = localizedUrl(canonicalLocale, path);
  const known = isAppLocale(locale) ? locale : DEFAULT_LOCALE;
  // A page that defines its own `openGraph` REPLACES its parent's, including
  // the file-based image from app/[locale]/opengraph-image.tsx — so say which
  // image to use explicitly. Pages with their own opengraph-image file (the
  // editorials) still override this, because file-based images win.
  const image = {
    url: localizedUrl(known, "/opengraph-image"),
    width: 1200,
    height: 630,
    alt: fullTitle,
  };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(path, availableLocales),
    },
    robots: robotsFor({ noindex }),
    openGraph: {
      type: ogType,
      siteName,
      title: fullTitle,
      description,
      url: canonical,
      locale: OG_LOCALES[known],
      alternateLocale: LOCALES.filter((l) => l !== known).map((l) => OG_LOCALES[l]),
      images: [image],
      ...(ogType === "article" && article
        ? {
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime,
            authors: article.authors,
            tags: article.tags,
            section: article.section,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image.url],
    },
  };
}

// --- JSON-LD -----------------------------------------------------------------

export type JsonLdObject = Record<string, unknown>;

/**
 * JSON.stringify is not enough for a <script> body: "</script>" inside a
 * string value would end the tag early. Escaping "<" (and the two line
 * separators JSON allows but JS doesn't) makes any string value safe.
 */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export const ORGANIZATION_ID = `${siteUrl}/#organization`;
export const WEBSITE_ID = `${siteUrl}/#website`;

export function organizationJsonLd(siteName: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: siteName,
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    sameAs: [REPO_URL],
  };
}

export function websiteJsonLd(input: {
  siteName: string;
  description: string;
  locale: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: input.siteName,
    url: localizedUrl(input.locale, "/"),
    description: input.description,
    inLanguage: input.locale,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Path without locale prefix; omit on the last (current) item. */
  path?: string;
}

export function breadcrumbJsonLd(locale: string, items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path !== undefined ? { item: localizedUrl(locale, item.path) } : {}),
    })),
  };
}

export function articleJsonLd(input: {
  locale: string;
  path: string;
  headline: string;
  description: string;
  author: string;
  publishedAt: string;
  modifiedAt?: string;
  keywords?: string[];
  section?: string;
  siteName: string;
  type?: "Article" | "TechArticle";
  authorType?: "Person" | "Organization";
}): JsonLdObject {
  const url = localizedUrl(input.locale, input.path);
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "Article",
    "@id": `${url}#article`,
    headline: input.headline,
    description: input.description,
    url,
    mainEntityOfPage: url,
    inLanguage: input.locale,
    isAccessibleForFree: true,
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt ?? input.publishedAt,
    author: { "@type": input.authorType ?? "Person", name: input.author },
    publisher: { "@id": ORGANIZATION_ID, "@type": "Organization", name: input.siteName },
    ...(input.keywords && input.keywords.length > 0 ? { keywords: input.keywords.join(", ") } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
  };
}

/**
 * Implementation fixtures and unfinished stubs are published in the archive
 * (the editorial pipeline has no draft state) but must not be offered to
 * search engines or AI crawlers. content/editorials/informatics/
 * programmable-scene-fixture.mdx is the current example: tagged "fixture",
 * with a placeholder author.
 */
export function isIndexableEditorial(editorial: {
  tags: readonly string[];
  author: string;
}): boolean {
  return !editorial.tags.includes("fixture") && !/^PLACEHOLDER\b/i.test(editorial.author.trim());
}
