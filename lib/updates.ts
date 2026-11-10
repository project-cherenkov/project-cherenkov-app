import { updates, type Update } from "#content";

import { resolveUpdates, type ResolvedUpdate } from "@/lib/updates-core";

export type { Update };
export type ResolvedUpdateEntry = ResolvedUpdate<Update>;

export function getUpdates(locale: string): ResolvedUpdateEntry[] {
  return resolveUpdates(updates, locale);
}

// Updates are listed on one page; the feed and sitemap use the original's date.
export function getLatestUpdateDate(): string | undefined {
  return resolveUpdates(updates, "en")[0]?.date;
}
