import { describe, expect, it } from "vitest";

import { pickVersion, splitTranslationSuffix, versionLocales } from "./content-language";

describe("splitTranslationSuffix", () => {
  it("separates a locale suffix from the slug", () => {
    expect(splitTranslationSuffix("binary-search.id")).toEqual({ slug: "binary-search", locale: "id" });
    expect(splitTranslationSuffix("binary-search")).toEqual({ slug: "binary-search" });
    expect(splitTranslationSuffix("v1.2-notes")).toEqual({ slug: "v1.2-notes" });
  });
});

describe("pickVersion", () => {
  const en = { locale: "en", isOriginal: true };
  const id = { locale: "id", isOriginal: false };

  it("flags a fallback only while the visitor's language is missing", () => {
    expect(pickVersion([en], "id")).toEqual({ version: en, isFallback: true });
    expect(pickVersion([en, id], "id")).toEqual({ version: id, isFallback: false });
    expect(pickVersion([en, id], "en")).toEqual({ version: en, isFallback: false });
  });

  it("returns undefined with no versions, and lists the real locales", () => {
    expect(pickVersion([], "en")).toBeUndefined();
    expect(versionLocales([en, id])).toEqual(["en", "id"]);
  });
});
