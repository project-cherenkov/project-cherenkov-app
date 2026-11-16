import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import en from "./messages/en";
import id from "./messages/id";
import { loadMessages } from "./messages";

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

// --- File layout --------------------------------------------------------
// messages/<locale>/*.json are merged by messages/<locale>/index.ts. These
// checks keep the two locale folders mirrored and make sure no file is left
// out of (or shadowed inside) the merged catalogue.

const messagesDir = path.join(__dirname, "messages");
const locales = ["en", "id"] as const;

function jsonFiles(locale: string): string[] {
  return readdirSync(path.join(messagesDir, locale))
    .filter((file) => file.endsWith(".json"))
    .sort();
}

function readJson(locale: string, file: string): unknown {
  return JSON.parse(readFileSync(path.join(messagesDir, locale, file), "utf8"));
}

// JSON.parse silently keeps the last of two equal keys, so a duplicated
// object key (this once hid syllabus.coverage.label) never fails a key-parity
// check. Scan the raw text instead.
function duplicateKeys(source: string): string[] {
  const duplicates: string[] = [];
  const scopes: Array<{ kind: "object" | "array"; keys: Set<string>; path: string }> = [];
  let pendingKey: string | null = null;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '"') {
      let end = i + 1;
      while (source[end] !== '"') end += source[end] === "\\" ? 2 : 1;
      const text = JSON.parse(source.slice(i, end + 1)) as string;
      const scope = scopes[scopes.length - 1];
      let next = end + 1;
      while (/\s/.test(source[next] ?? "")) next += 1;
      if (scope?.kind === "object" && source[next] === ":") {
        const where = scope.path ? `${scope.path}.${text}` : text;
        if (scope.keys.has(text)) duplicates.push(where);
        scope.keys.add(text);
        pendingKey = text;
      }
      i = end + 1;
      continue;
    }
    if (char === "{" || char === "[") {
      const parent = scopes[scopes.length - 1];
      const here = pendingKey && parent ? (parent.path ? `${parent.path}.${pendingKey}` : pendingKey) : "";
      scopes.push({ kind: char === "{" ? "object" : "array", keys: new Set(), path: here });
      pendingKey = null;
    } else if (char === "}" || char === "]") {
      scopes.pop();
      pendingKey = null;
    }
    i += 1;
  }
  return duplicates;
}

describe("message files", () => {
  it("duplicateKeys finds a repeated key and ignores repeats in different objects", () => {
    expect(duplicateKeys('{"a":{"x":1},"b":{"x":2}}')).toEqual([]);
    expect(duplicateKeys('{"a":{"x":1,"x":2}}')).toEqual(["a.x"]);
    expect(duplicateKeys('{"a":1,"a":2}')).toEqual(["a"]);
  });

  it("en and id folders contain the same file names", () => {
    expect(jsonFiles("id")).toEqual(jsonFiles("en"));
  });

  it.each(locales)("%s files have no duplicate JSON keys", (locale) => {
    for (const file of jsonFiles(locale)) {
      const source = readFileSync(path.join(messagesDir, locale, file), "utf8");
      expect(duplicateKeys(source), `${locale}/${file}`).toEqual([]);
    }
  });

  it.each(locales)("%s files define disjoint namespaces and all reach the merged catalogue", (locale) => {
    const catalogue = locale === "en" ? en : id;
    const seen = new Map<string, string>();
    for (const file of jsonFiles(locale)) {
      for (const namespace of Object.keys(readJson(locale, file) as Record<string, unknown>)) {
        expect(seen.get(namespace), `"${namespace}" in ${locale}/${file} also in ${locale}/${seen.get(namespace)}`).toBeUndefined();
        seen.set(namespace, file);
      }
    }
    expect(Object.keys(catalogue).sort()).toEqual([...seen.keys()].sort());
  });

  it("each key lives in the same file in both locales", () => {
    for (const file of jsonFiles("en")) {
      const enNamespaces = Object.keys(readJson("en", file) as Record<string, unknown>).sort();
      const idNamespaces = Object.keys(readJson("id", file) as Record<string, unknown>).sort();
      expect(idNamespaces, file).toEqual(enNamespaces);
    }
  });

  it("loadMessages serves each locale's merged catalogue", async () => {
    expect(await loadMessages("en")).toBe(en);
    expect(await loadMessages("id")).toBe(id);
  });
});
