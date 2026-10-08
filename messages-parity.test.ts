import { describe, expect, it } from "vitest";

import en from "./messages/en.json";
import id from "./messages/id.json";

// Both locales are served; a key that exists in only one renders as a raw
// key path ("docs.fallbackNotice") — or throws — for half the audience.
function keys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("message catalogues", () => {
  it("en and id define exactly the same keys", () => {
    const enKeys = new Set(keys(en));
    const idKeys = new Set(keys(id));
    expect([...enKeys].filter((k) => !idKeys.has(k)), "missing in id.json").toEqual([]);
    expect([...idKeys].filter((k) => !enKeys.has(k)), "missing in en.json").toEqual([]);
  });

  it("no message is empty", () => {
    for (const [name, catalogue] of [["en", en], ["id", id]] as const) {
      const empty = keys(catalogue).filter((key) => {
        const value = key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], catalogue);
        return typeof value === "string" && value.trim() === "";
      });
      expect(empty, `${name}.json`).toEqual([]);
    }
  });

  it("ICU placeholders match between locales", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();
    const get = (catalogue: unknown, key: string) =>
      key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], catalogue);
    for (const key of keys(en)) {
      const a = get(en, key);
      const b = get(id, key);
      if (typeof a === "string" && typeof b === "string") {
        expect(placeholders(b), key).toEqual(placeholders(a));
      }
    }
  });
});
