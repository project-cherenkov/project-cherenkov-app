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

// Chat apps (Discord, Slack, WhatsApp...) cache a link preview's image by its
// URL, and this route's URL never changes when the card is redrawn — so a
// redesigned card keeps showing the old picture wherever the link was already
// shared. Bump this whenever the share card's look changes; it only has to
// differ from the previous value.
export const OG_IMAGE_VERSION = 2;

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

export function robotsFor(
  options: { noindex?: boolean; followLinks?: boolean } = {},
): NonNullable<Metadata["robots"]> {
  const index = isIndexingEnabled() && !options.noindex;
  // Language fallbacks are noindex but still pass link signals ("noindex,
  // follow"); everything else that is noindex stays "nofollow".
  const follow = index || (isIndexingEnabled() && options.followLinks === true);
  return { index, follow };
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
  /**
   * Path (WITHOUT the locale prefix) of this page's own share card, e.g.
   * "/archive/astronomy/why-a-sidereal-day-is-shorter/opengraph-image".
   * Defaults to the site-wide card.
   */
  imagePath?: string;
  /** `noindex` but keep following links (language fallbacks). */
  followLinks?: boolean;
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
    followLinks = false,
    availableLocales = LOCALES,
    canonicalLocale = locale,
    article,
  } = input;
  const description = truncate(input.description, 200);
  const fullTitle = absoluteTitle ? title : `${title} | ${siteName}`;
  const canonical = localizedUrl(canonicalLocale, path);
  const known = isAppLocale(locale) ? locale : DEFAULT_LOCALE;
  // A page that defines its own `openGraph` REPLACES its parent's, including
  // the file-based image from app/[locale]/opengraph-image.tsx — so say which
  // image to use explicitly. An explicit entry here also beats a page's own
  // opengraph-image file in the built output, so pages with their own card
  // (the editorials) must pass `imagePath` rather than rely on the file.
  const image = {
    url: `${localizedUrl(known, input.imagePath ?? "/opengraph-image")}?v=${OG_IMAGE_VERSION}`,
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
      // Feed discovery: this replaces the layout's `alternates`, so it has to
      // be repeated here for every page that builds its own metadata.
      types: { "application/rss+xml": `${siteUrl}/updates/feed.xml` },
    },
    robots: robotsFor({ noindex, followLinks }),
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

// Other names the project goes by. "Cherenkov" alone is also a physics term,
// so the full name is the primary one and the short form an alias.
export const ORGANIZATION_ALTERNATE_NAMES = ["Cherenkov"];
// Public profiles that identify the same entity. Add the project's social
// accounts here once they are settled.
export const ORGANIZATION_SAME_AS = [REPO_URL];

export function organizationJsonLd(siteName: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: siteName,
    alternateName: ORGANIZATION_ALTERNATE_NAMES,
    url: siteUrl,
    // PNG for consumers that do not read SVG; Google wants at least 112 px.
    logo: `${siteUrl}/icon-512.png`,
    sameAs: ORGANIZATION_SAME_AS,
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
  /** Absolute URL of the page's share card. */
  image?: string;
  /** Absolute URL of the author's page (the team entry on About). */
  authorUrl?: string;
  /** Language the text is actually written in (not the URL's locale). */
  textLanguage?: string;
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
    inLanguage: input.textLanguage ?? input.locale,
    isAccessibleForFree: true,
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt ?? input.publishedAt,
    ...(input.image ? { image: [input.image] } : {}),
    author: {
      "@type": input.authorType ?? "Person",
      name: input.author,
      ...(input.authorUrl ? { url: input.authorUrl } : {}),
    },
    publisher: { "@id": ORGANIZATION_ID, "@type": "Organization", name: input.siteName },
    ...(input.keywords && input.keywords.length > 0 ? { keywords: input.keywords.join(", ") } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
  };
}

/**
 * Draft editorials (visible to editors only), implementation fixtures and
 * unfinished stubs must not be offered to search engines or AI crawlers.
 * Draft ones are already left out of the sitemap and llms.txt because the
 * public content helpers skip them; checking `status` here is the second
 * line of defence for any page that renders one for an editor.
 * content/editorials/informatics/programmable-scene-fixture.mdx is the
 * current example: draft, tagged "fixture", with a placeholder author.
 */
export function isIndexableEditorial(editorial: {
  tags: readonly string[];
  author: string;
  status?: string;
}): boolean {
  return (
    editorial.status !== "draft" &&
    !editorial.tags.includes("fixture") &&
    !/^PLACEHOLDER\b/i.test(editorial.author.trim())
  );
}
