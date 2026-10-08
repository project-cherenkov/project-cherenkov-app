// Thin binding of lib/docs-core.ts to Velite's generated docs collection.
// Like lib/content.ts, nothing in app/ imports "#content" for docs directly.
import { docs, type Doc } from "#content";

import {
  getNeighbours,
  groupBySection,
  localesWithDoc,
  resolveDoc,
  resolveDocs,
  type ResolvedDoc,
} from "@/lib/docs-core";

export type { Doc };
export type ResolvedDocPage = ResolvedDoc<Doc>;

export function getDocPages(locale: string): ResolvedDoc<Doc>[] {
  return resolveDocs(docs, locale);
}

export function getDocPage(locale: string, slug: string): ResolvedDoc<Doc> | undefined {
  return resolveDoc(docs, locale, slug);
}

export function getDocSections(locale: string) {
  return groupBySection(getDocPages(locale));
}

export function getDocNeighbours(locale: string, slug: string) {
  return getNeighbours(getDocPages(locale), slug);
}

export function getDocLocales(slug: string): string[] {
  return localesWithDoc(docs, slug);
}

/** Every slug that exists in the source language — the set of docs URLs. */
export function getAllDocSlugs(): string[] {
  return getDocPages("en").map((entry) => entry.doc.slug);
}
