// Thin query layer over Velite's generated content. Nothing in app/ should
// import "#content" directly — go through these helpers so filtering/sorting
// logic lives in one place instead of being copy-pasted into every page.
import {
  editorialTranslations,
  editorials,
  materialTranslations,
  materials,
  type Editorial,
  type Material,
} from "#content";

import { pickVersion, type LanguageVersion } from "@/lib/content-language";

export type Subject = Editorial["subject"];

// Visibility. Every helper below returns PUBLISHED content only unless the
// caller passes { includeDrafts: true }. That is deliberate: the sitemap,
// search index, llms.txt, home page, syllabus and planner all call these
// helpers with no arguments, so a draft item can never leak into them by
// accident. Only code that has first confirmed the visitor is an editor
// (lib/editor-access.ts) may opt in.
export interface VisibilityOptions {
  includeDrafts?: boolean;
}

function isVisible(item: { status: string }, options: VisibilityOptions): boolean {
  return options.includeDrafts === true || item.status === "published";
}

export function getAllEditorials(options: VisibilityOptions = {}): Editorial[] {
  return editorials
    .filter((e) => isVisible(e, options))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
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
  options: VisibilityOptions = {},
): Editorial | undefined {
  return editorials.find(
    (e) => e.subject === subject && e.slug === slug && isVisible(e, options),
  );
}

// True when the editorial exists but is a draft. Lets a page tell "does not
// exist" apart from "exists, editors only" without exposing any of its content.
export function isDraftEditorial(subject: string, slug: string): boolean {
  return editorials.some(
    (e) => e.subject === subject && e.slug === slug && e.status === "draft",
  );
}

export interface ArchiveFilters {
  subject?: string;
  principle?: string;
  errorType?: string;
}

export function filterEditorials(
  filters: ArchiveFilters,
  options: VisibilityOptions = {},
): Editorial[] {
  return getAllEditorials(options).filter((e) => {
    if (filters.subject && e.subject !== filters.subject) return false;
    if (filters.principle && e.principle !== filters.principle) return false;
    if (filters.errorType && e.errorType !== filters.errorType) return false;
    return true;
  });
}

// Archive is indexed by principle + error type, not by chapter (spec §1) —
// these power the filter dropdowns in components/site/archive-filters.tsx.
export function getArchiveFacets(
  filters: ArchiveFilters = {},
  options: VisibilityOptions = {},
) {
  const forSubject = filterEditorials(
    { principle: filters.principle, errorType: filters.errorType },
    options,
  );
  const forPrinciple = filterEditorials(
    { subject: filters.subject, errorType: filters.errorType },
    options,
  );
  const forErrorType = filterEditorials(
    { subject: filters.subject, principle: filters.principle },
    options,
  );
  return {
    subjects: uniqueSorted(forSubject.map((e) => e.subject)),
    principles: uniqueSorted(forPrinciple.map((e) => e.principle)),
    errorTypes: uniqueSorted(
      forErrorType.map((e) => e.errorType).filter((v): v is string => Boolean(v)),
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
  return editorial.vizConfig.discriminant === "none";
}

// --- Materials (topic-by-topic syllabus breakdowns) -------------------------

export function getAllMaterials(options: VisibilityOptions = {}): Material[] {
  return materials
    .filter((m) => isVisible(m, options))
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.slug.localeCompare(b.slug));
}

export function getMaterial(
  subject: string,
  slug: string,
  options: VisibilityOptions = {},
): Material | undefined {
  return materials.find(
    (m) => m.subject === subject && m.slug === slug && isVisible(m, options),
  );
}

export function isDraftMaterial(subject: string, slug: string): boolean {
  return materials.some(
    (m) => m.subject === subject && m.slug === slug && m.status === "draft",
  );
}

// --- Language ----------------------------------------------------------------
//
// An editorial or material is written in one language (`language`, default
// "en") and may have translations (`<slug>.id.mdx`). These pick the text for
// the visitor's language and say whether it is a fallback. The notice is
// derived from that, never stored: once a translation exists the page stops
// showing it. See lib/content-language.ts.

export interface EditorialText extends LanguageVersion {
  title: string;
  hook: string;
  body: string;
}

export interface MaterialText extends LanguageVersion {
  title: string;
  summary: string;
  body: string;
}

export interface ResolvedText<T extends LanguageVersion> {
  text: T;
  isFallback: boolean;
  // Languages the item genuinely exists in.
  locales: string[];
}

export function resolveEditorialText(
  editorial: Editorial,
  locale: string,
): ResolvedText<EditorialText> {
  const original: EditorialText = {
    locale: editorial.language,
    isOriginal: true,
    title: editorial.title,
    hook: editorial.hook,
    body: editorial.body,
  };
  const translations: EditorialText[] = editorialTranslations
    .filter((t) => t.subject === editorial.subject && t.slug === editorial.slug)
    .map((t) => ({ locale: t.locale, isOriginal: false, title: t.title, hook: t.hook, body: t.body }));
  const versions = [original, ...translations];
  const picked = pickVersion(versions, locale)!;
  return { text: picked.version, isFallback: picked.isFallback, locales: versions.map((v) => v.locale) };
}

export function resolveMaterialText(
  material: Material,
  locale: string,
): ResolvedText<MaterialText> {
  const original: MaterialText = {
    locale: material.language,
    isOriginal: true,
    title: material.title,
    summary: material.summary,
    body: material.body,
  };
  const translations: MaterialText[] = materialTranslations
    .filter((t) => t.subject === material.subject && t.slug === material.slug)
    .map((t) => ({ locale: t.locale, isOriginal: false, title: t.title, summary: t.summary, body: t.body }));
  const versions = [original, ...translations];
  const picked = pickVersion(versions, locale)!;
  return { text: picked.version, isFallback: picked.isFallback, locales: versions.map((v) => v.locale) };
}
