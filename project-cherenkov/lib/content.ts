// Thin query layer over Velite's generated content. Nothing in app/ should
// import "#content" directly — go through these helpers so filtering/sorting
// logic lives in one place instead of being copy-pasted into every page.
import { editorials, type Editorial } from "#content";

export type Subject = Editorial["subject"];

export function getAllEditorials(): Editorial[] {
  return [...editorials].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
  );
}

export function getRecentEditorials(limit = 6): Editorial[] {
  return getAllEditorials().slice(0, limit);
}

export function getEditorialsBySubject(subject: Subject): Editorial[] {
  return getAllEditorials().filter((e) => e.subject === subject);
}

export function getEditorial(
  subject: string,
  slug: string,
): Editorial | undefined {
  return editorials.find((e) => e.subject === subject && e.slug === slug);
}

export interface ArchiveFilters {
  subject?: string;
  principle?: string;
  errorType?: string;
}

export function filterEditorials(filters: ArchiveFilters): Editorial[] {
  return getAllEditorials().filter((e) => {
    if (filters.subject && e.subject !== filters.subject) return false;
    if (filters.principle && e.principle !== filters.principle) return false;
    if (filters.errorType && e.errorType !== filters.errorType) return false;
    return true;
  });
}

// Archive is indexed by principle + error type, not by chapter (spec §1) —
// these power the filter dropdowns in components/site/archive-filters.tsx.
export function getArchiveFacets() {
  const all = getAllEditorials();
  return {
    subjects: uniqueSorted(all.map((e) => e.subject)),
    principles: uniqueSorted(all.map((e) => e.principle)),
    errorTypes: uniqueSorted(
      all.map((e) => e.errorType).filter((v): v is string => Boolean(v)),
    ),
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

// spec §1 ("every published editorial ships with a working interactive
// visualization") vs. spec §6 (schema allows vizEngine: "none") conflict —
// see velite.config.ts. Rather than silently drop these editorials or
// silently render nothing, treat "none" as a flagged content error the UI
// surfaces instead of hiding.
export function hasMissingViz(editorial: Editorial): boolean {
  return editorial.vizEngine === "none";
}
