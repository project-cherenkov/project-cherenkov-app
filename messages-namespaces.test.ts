import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import en from "./messages/en";
import id from "./messages/id";

// next-intl does not fail when a namespace is misspelled: it logs and renders
// the key path. Moving strings between message files makes that typo easy, so
// check every literal namespace passed to useTranslations/getTranslations.

const SKIP = new Set(["node_modules", ".next", ".velite", ".git", "public", "drizzle"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const NAMESPACE =
  /(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?"([A-Za-z][A-Za-z0-9.]*)"/g;

function resolve(catalogue: unknown, namespace: string): unknown {
  return namespace.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalogue);
}

describe("translation namespaces", () => {
  const used = sourceFiles(__dirname).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(NAMESPACE)].map((match) => ({
      namespace: match[1] ?? "",
      file: path.relative(__dirname, file),
    })),
  );

  it("finds the call sites it is meant to check", () => {
    expect(used.length).toBeGreaterThan(50);
  });

  it.each([
    ["en", en],
    ["id", id],
  ] as const)("every literal namespace in the source exists in %s", (_locale, catalogue) => {
    const unresolved = used
      .filter(({ namespace }) => typeof resolve(catalogue, namespace) !== "object")
      .map(({ namespace, file }) => `${namespace} (${file})`);
    expect(unresolved).toEqual([]);
  });
});
