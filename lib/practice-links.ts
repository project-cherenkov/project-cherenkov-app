// External practice links on editorials (R7), e.g. problems on TLX. LINKS
// ONLY: the problem statements stay on the other site (they belong to its
// organisers), and each link carries a "checked on" date so a dead or moved
// link is visible instead of silently rotting.
//
// Pure, and importable from velite.config.ts (build-time validation) as well
// as from the page that renders the links.

export const PRACTICE_LINK_STALE_DAYS = 180;

export interface PracticeLink {
  title: string;
  url: string;
  // ISO date (or datetime) of the last time a person confirmed it still works.
  checkedOn: string;
}

// https only, with a real host. Rejects javascript:, data:, http:, and
// anything that does not parse as a URL.
export function isSafePracticeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

// Whole days since `checkedOn` (negative if it is in the future); NaN-safe.
export function practiceLinkAgeDays(checkedOn: string, now: Date): number {
  const checked = Date.parse(checkedOn);
  if (Number.isNaN(checked)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - checked) / 86_400_000);
}

export function isPracticeLinkStale(checkedOn: string, now: Date): boolean {
  return practiceLinkAgeDays(checkedOn, now) > PRACTICE_LINK_STALE_DAYS;
}
