// Which visualizations a visitor has chosen for the home hero ("your picks").
//
// Everything here is pure, so the browser hook, the API route and the tests all
// use the same rules. A pick is the key of a published editorial that has a
// visualization: "<subject>/<slug>", for example "physics/projectile-range-
// symmetry". Picks are editorial instances, not engines: two picks may use the
// same engine, and they are not grouped by subject.

export const MIN_HOME_VIZ_PICKS = 1;
export const MAX_HOME_VIZ_PICKS = 3;

// What a visitor sees until they choose. Deliberately an explicit list rather
// than "the newest three": the project spans three subjects, and the newest
// editorials are not spread across them. A key that is no longer published is
// skipped (see resolveHomeVizPicks), so renaming or unpublishing is safe.
export const DEFAULT_HOME_VIZ_KEYS: readonly string[] = [
  "physics/projectile-range-symmetry",
  "astronomy/eccentric-transit-duration",
  "informatics/binary-search-on-answer",
];

// Local storage key. The "-v1" is the format version of the stored value.
export const HOME_VIZ_PICKS_STORAGE_KEY = "home-viz-picks-v1";

const KEY_PATTERN = /^[a-z0-9-]{1,60}\/[a-z0-9-]{1,100}$/;

export function isHomeVizKey(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value);
}

/**
 * Turns anything read from storage, the network or a request body into a clean
 * list: well-formed keys only, no duplicates, at most MAX_HOME_VIZ_PICKS, in
 * the order given. Returns null for "no usable selection" (not an array, or
 * nothing valid in it), which callers treat as "use the defaults".
 */
export function parseHomeVizPicks(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const picks: string[] = [];
  for (const item of raw) {
    if (!isHomeVizKey(item) || picks.includes(item)) continue;
    picks.push(item);
    if (picks.length === MAX_HOME_VIZ_PICKS) break;
  }
  return picks.length >= MIN_HOME_VIZ_PICKS ? picks : null;
}

/**
 * What to show: the saved picks that are still available, else the defaults
 * that are available, else the first few available. Never empty unless
 * nothing at all is available. The saved list is not rewritten here: an
 * editorial that is unpublished for a while keeps its place in storage.
 */
export function resolveHomeVizPicks(
  saved: readonly string[] | null | undefined,
  available: readonly string[],
): string[] {
  const isAvailable = (key: string) => available.includes(key);
  const fromSaved = (saved ?? []).filter(isAvailable);
  if (fromSaved.length > 0) return fromSaved.slice(0, MAX_HOME_VIZ_PICKS);
  const fromDefaults = DEFAULT_HOME_VIZ_KEYS.filter(isAvailable);
  if (fromDefaults.length > 0) return fromDefaults.slice(0, MAX_HOME_VIZ_PICKS);
  return available.slice(0, MAX_HOME_VIZ_PICKS);
}

/**
 * Signed in: the account wins when it has a selection; otherwise a selection
 * made on this device is kept and should be uploaded. `upload` is true only in
 * that second case. With neither, `picks` is null (use the defaults).
 */
export function mergeHomeVizPicks(
  device: readonly string[] | null,
  account: readonly string[] | null,
): { picks: string[] | null; upload: boolean } {
  if (account && account.length > 0) return { picks: [...account], upload: false };
  if (device && device.length > 0) return { picks: [...device], upload: true };
  return { picks: null, upload: false };
}

// The two functions below take the storage object as a parameter so they can be
// tested without a browser and never throw (private mode and blocked storage
// both make localStorage throw).
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readLocalHomeVizPicks(storage: StorageLike | undefined): string[] | null {
  try {
    const raw = storage?.getItem(HOME_VIZ_PICKS_STORAGE_KEY);
    return raw ? parseHomeVizPicks(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** null clears the saved selection (back to the defaults). */
export function writeLocalHomeVizPicks(
  storage: StorageLike | undefined,
  picks: readonly string[] | null,
): void {
  try {
    if (picks === null) storage?.removeItem(HOME_VIZ_PICKS_STORAGE_KEY);
    else storage?.setItem(HOME_VIZ_PICKS_STORAGE_KEY, JSON.stringify(picks));
  } catch {
    // Private mode or blocked storage: the choice lasts for this page view only.
  }
}
