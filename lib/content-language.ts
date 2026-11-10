// Which language a piece of content is shown in, and whether the visitor needs
// a notice that it is not their own. Pure, so it can be tested without a content
// build, and shared by editorials, materials, updates and anything added later.
//
// The notice is DERIVED from what exists, never stored: a page shows it only
// when no version in the visitor's language exists. Add the translation file
// and the notice disappears by itself; there is no flag to remember to clear.
//
// File convention (editorials, materials, updates):
//   <slug>.mdx       the original, written in `language` (default "en")
//   <slug>.<loc>.mdx a translation of it, e.g. <slug>.id.mdx
export const CONTENT_LOCALES = ["en", "id"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

// Used when an original does not say which language it is written in.
export const DEFAULT_CONTENT_LANGUAGE: ContentLocale = "en";

const SUFFIX = new RegExp(`^(.+)\\.(${CONTENT_LOCALES.join("|")})$`);

// "binary-search.id" -> { slug: "binary-search", locale: "id" };
// "binary-search"    -> { slug: "binary-search" } (an original).
export function splitTranslationSuffix(fileSlug: string): {
  slug: string;
  locale?: ContentLocale;
} {
  const match = SUFFIX.exec(fileSlug);
  if (!match) return { slug: fileSlug };
  return { slug: match[1]!, locale: match[2] as ContentLocale };
}

export interface LanguageVersion {
  // The language this version is written in.
  locale: string;
  isOriginal: boolean;
}

export interface PickedVersion<T extends LanguageVersion> {
  version: T;
  // True when the visitor's language has no version and another is shown.
  isFallback: boolean;
}

// The version in the visitor's language if there is one, else the original.
export function pickVersion<T extends LanguageVersion>(
  versions: readonly T[],
  requested: string,
): PickedVersion<T> | undefined {
  const exact = versions.find((entry) => entry.locale === requested);
  if (exact) return { version: exact, isFallback: false };
  const original = versions.find((entry) => entry.isOriginal);
  return original ? { version: original, isFallback: original.locale !== requested } : undefined;
}

// Languages the content genuinely exists in (for hreflang, and to decide
// whether a locale's URL is a real page or a fallback to index with care).
export function versionLocales(versions: readonly LanguageVersion[]): string[] {
  return [...new Set(versions.map((entry) => entry.locale))];
}
