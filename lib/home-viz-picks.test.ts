import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_VIZ_KEYS,
  HOME_VIZ_PICKS_STORAGE_KEY,
  isHomeVizKey,
  mergeHomeVizPicks,
  parseHomeVizPicks,
  readLocalHomeVizPicks,
  resolveHomeVizPicks,
  writeLocalHomeVizPicks,
} from "./home-viz-picks";

const A = "physics/projectile-range-symmetry";
const B = "astronomy/eccentric-transit-duration";
const C = "informatics/binary-search-on-answer";
const D = "astronomy/why-a-sidereal-day-is-shorter";

describe("isHomeVizKey", () => {
  it("accepts subject/slug and nothing else", () => {
    expect(isHomeVizKey(A)).toBe(true);
    for (const bad of ["", "physics", "physics/", "/x", "a/b/c", "Physics/x", "a b/c", "../x/y", 3, null]) {
      expect(isHomeVizKey(bad)).toBe(false);
    }
  });
});

describe("parseHomeVizPicks", () => {
  it("keeps order, drops duplicates and malformed keys, caps at three", () => {
    expect(parseHomeVizPicks([B, "nope", B, A, C, D])).toEqual([B, A, C]);
  });
  it("returns null when nothing usable remains", () => {
    expect(parseHomeVizPicks([])).toBeNull();
    expect(parseHomeVizPicks(["x"])).toBeNull();
    expect(parseHomeVizPicks("physics/a")).toBeNull();
    expect(parseHomeVizPicks(undefined)).toBeNull();
  });
});

describe("resolveHomeVizPicks", () => {
  const available = [A, B, C, D];
  it("uses saved picks that are still available, in saved order", () => {
    expect(resolveHomeVizPicks([D, A], available)).toEqual([D, A]);
  });
  it("skips a saved pick that is no longer published", () => {
    expect(resolveHomeVizPicks(["physics/gone", D], available)).toEqual([D]);
  });
  it("falls back to the defaults when no saved pick survives", () => {
    expect(resolveHomeVizPicks(["physics/gone"], available)).toEqual([A, B, C]);
    expect(resolveHomeVizPicks(null, available)).toEqual([A, B, C]);
  });
  it("falls back to the first available when the defaults are gone too", () => {
    expect(resolveHomeVizPicks(null, [D, "physics/new"])).toEqual([D, "physics/new"]);
  });
  it("returns an empty list only when nothing is available", () => {
    expect(resolveHomeVizPicks([A], [])).toEqual([]);
  });
  it("names defaults that are well-formed keys", () => {
    expect(DEFAULT_HOME_VIZ_KEYS.every(isHomeVizKey)).toBe(true);
  });
});

describe("mergeHomeVizPicks", () => {
  it("lets the account win and uploads nothing", () => {
    expect(mergeHomeVizPicks([A], [B, C])).toEqual({ picks: [B, C], upload: false });
  });
  it("keeps the device selection and asks to upload it when the account has none", () => {
    expect(mergeHomeVizPicks([A], null)).toEqual({ picks: [A], upload: true });
  });
  it("returns no selection when neither has one", () => {
    expect(mergeHomeVizPicks(null, null)).toEqual({ picks: null, upload: false });
  });
});

describe("local storage helpers", () => {
  function fakeStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
      data,
      getItem: (k: string) => (k in data ? data[k]! : null),
      setItem: (k: string, v: string) => void (data[k] = v),
      removeItem: (k: string) => void delete data[k],
    };
  }
  it("round-trips a selection", () => {
    const s = fakeStorage();
    writeLocalHomeVizPicks(s, [B, A]);
    expect(readLocalHomeVizPicks(s)).toEqual([B, A]);
  });
  it("clears with null", () => {
    const s = fakeStorage({ [HOME_VIZ_PICKS_STORAGE_KEY]: JSON.stringify([A]) });
    writeLocalHomeVizPicks(s, null);
    expect(readLocalHomeVizPicks(s)).toBeNull();
  });
  it("treats corrupt data as no selection", () => {
    expect(readLocalHomeVizPicks(fakeStorage({ [HOME_VIZ_PICKS_STORAGE_KEY]: "{oops" }))).toBeNull();
  });
  it("never throws when storage does", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readLocalHomeVizPicks(throwing)).toBeNull();
    expect(() => writeLocalHomeVizPicks(throwing, [A])).not.toThrow();
    expect(() => writeLocalHomeVizPicks(throwing, null)).not.toThrow();
    expect(readLocalHomeVizPicks(undefined)).toBeNull();
  });
});
