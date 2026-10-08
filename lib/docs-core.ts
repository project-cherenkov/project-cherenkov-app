// Pure selection logic for the docs, separate from lib/docs.ts (which binds it
// to Velite's generated `#content`) so it can be unit-tested without a
// content build. See velite.config.ts for the file layout.

/** English is the source of truth; every other locale falls back to it. */
export const DOCS_SOURCE_LOCALE = "en";

/** Order sections appear in the sidebar and on the index page. */
export const DOC_SECTION_ORDER = ["start", "reading", "contributing"] as const;
export type DocSection = (typeof DOC_SECTION_ORDER)[number];

export interface DocLike {
  title: string;
  description: string;
  section: DocSection;
  order: number;
  updatedAt?: string | undefined;
  locale: string;
  slug: string;
}

export interface ResolvedDoc<T extends DocLike> {
  doc: T;
  /** True when the reader's language has no file and the English one is shown. */
  isFallback: boolean;
}

function compareDocs(a: DocLike, b: DocLike): number {
  return (
    DOC_SECTION_ORDER.indexOf(a.section) - DOC_SECTION_ORDER.indexOf(b.section) ||
    a.order - b.order ||
    a.title.localeCompare(b.title)
  );
}

/** Every doc page, in the language requested where it exists, English otherwise. */
export function resolveDocs<T extends DocLike>(all: readonly T[], locale: string): ResolvedDoc<T>[] {
  const bySlug = new Map<string, ResolvedDoc<T>>();
  // Source-locale pages define which slugs exist at all.
  for (const doc of all) {
    if (doc.locale === DOCS_SOURCE_LOCALE) bySlug.set(doc.slug, { doc, isFallback: locale !== DOCS_SOURCE_LOCALE });
  }
  if (locale !== DOCS_SOURCE_LOCALE) {
    for (const doc of all) {
      if (doc.locale === locale && bySlug.has(doc.slug)) bySlug.set(doc.slug, { doc, isFallback: false });
    }
  }
  return [...bySlug.values()].sort((a, b) => compareDocs(a.doc, b.doc));
}

export function resolveDoc<T extends DocLike>(
  all: readonly T[],
  locale: string,
  slug: string,
): ResolvedDoc<T> | undefined {
  return resolveDocs(all, locale).find((entry) => entry.doc.slug === slug);
}

/** Locales in which `slug` genuinely exists (used for hreflang). */
export function localesWithDoc(all: readonly DocLike[], slug: string): string[] {
  return [...new Set(all.filter((doc) => doc.slug === slug).map((doc) => doc.locale))];
}

export function groupBySection<T extends DocLike>(entries: readonly ResolvedDoc<T>[]) {
  return DOC_SECTION_ORDER.map((section) => ({
    section,
    entries: entries.filter((entry) => entry.doc.section === section),
  })).filter((group) => group.entries.length > 0);
}

export function getNeighbours<T extends DocLike>(entries: readonly ResolvedDoc<T>[], slug: string) {
  const index = entries.findIndex((entry) => entry.doc.slug === slug);
  return {
    previous: index > 0 ? entries[index - 1] : undefined,
    next: index >= 0 && index < entries.length - 1 ? entries[index + 1] : undefined,
  };
}
