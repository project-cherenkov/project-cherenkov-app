// Selection logic for /updates, separate from lib/updates.ts (which binds it to
// Velite's generated `#content`) so it can be unit-tested without a build.
import { pickVersion, versionLocales } from "./content-language";

export const UPDATE_TYPES = ["syllabus", "content", "feature", "fix", "notice"] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];

export interface UpdateLike {
  slug: string;
  title: string;
  summary: string;
  author?: string | undefined;
  date?: string | undefined;
  type?: UpdateType | undefined;
  pinned?: boolean | undefined;
  locale: string;
  isOriginal: boolean;
}

export interface ResolvedUpdate<T extends UpdateLike> {
  // The text shown: the visitor's language where it exists, else the original.
  update: T;
  // Date and type always come from the original.
  date: string;
  type: UpdateType;
  author?: string | undefined;
  // True when the visitor's language has no version and the original is shown.
  isFallback: boolean;
  // Languages this update genuinely exists in.
  locales: string[];
  // Pinned updates sort to the top of the list, above date order.
  pinned: boolean;
}

export function resolveUpdates<T extends UpdateLike>(
  all: readonly T[],
  locale: string,
): ResolvedUpdate<T>[] {
  const bySlug = new Map<string, T[]>();
  for (const entry of all) bySlug.set(entry.slug, [...(bySlug.get(entry.slug) ?? []), entry]);

  const resolved: ResolvedUpdate<T>[] = [];
  for (const versions of bySlug.values()) {
    const original = versions.find((entry) => entry.isOriginal);
    // A translation with no original is an orphan; the integrity test rejects
    // it, and it is never shown.
    if (!original || !original.date || !original.type) continue;
    const picked = pickVersion(versions, locale);
    if (!picked) continue;
    resolved.push({
      update: picked.version,
      date: original.date,
      type: original.type,
      author: original.author,
      isFallback: picked.isFallback,
      locales: versionLocales(versions),
      pinned: original.pinned ?? false,
    });
  }
  // Pinned first; then newest first; the slug breaks ties so the order is stable.
  return resolved.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.date.localeCompare(a.date) ||
      a.update.slug.localeCompare(b.update.slug),
  );
}
