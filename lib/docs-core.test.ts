import { describe, expect, it } from "vitest";

import { getNeighbours, groupBySection, localesWithDoc, resolveDoc, resolveDocs, type DocLike } from "./docs-core";

function doc(locale: string, slug: string, section: DocLike["section"], order: number, title = slug): DocLike {
  return { locale, slug, section, order, title, description: "d" };
}

const all: DocLike[] = [
  doc("en", "a", "start", 10),
  doc("en", "b", "reading", 10),
  doc("en", "c", "reading", 5),
  doc("en", "d", "contributing", 1),
  doc("id", "a", "start", 10, "A (id)"),
  // An orphan translation with no English original must not create a page.
  doc("id", "orphan", "start", 1),
];

describe("resolveDocs", () => {
  it("English locale: every English page, none flagged as fallback", () => {
    const pages = resolveDocs(all, "en");
    expect(pages.map((p) => p.doc.slug)).toEqual(["a", "c", "b", "d"]);
    expect(pages.every((p) => !p.isFallback)).toBe(true);
  });

  it("other locale: translated pages win, the rest fall back to English", () => {
    const pages = resolveDocs(all, "id");
    const byslug = Object.fromEntries(pages.map((p) => [p.doc.slug, p]));
    expect(byslug["a"]).toMatchObject({ isFallback: false });
    expect(byslug["a"]?.doc.title).toBe("A (id)");
    expect(byslug["b"]).toMatchObject({ isFallback: true });
    expect(byslug["orphan"]).toBeUndefined();
  });

  it("orders by section, then order, then title", () => {
    expect(resolveDocs(all, "en").map((p) => p.doc.slug)).toEqual(["a", "c", "b", "d"]);
  });
});

describe("resolveDoc / localesWithDoc", () => {
  it("finds a single page, or undefined for an unknown slug", () => {
    expect(resolveDoc(all, "id", "b")?.isFallback).toBe(true);
    expect(resolveDoc(all, "en", "nope")).toBeUndefined();
  });

  it("reports the locales a slug really exists in", () => {
    expect(localesWithDoc(all, "a").sort()).toEqual(["en", "id"]);
    expect(localesWithDoc(all, "b")).toEqual(["en"]);
  });
});

describe("groupBySection / getNeighbours", () => {
  it("groups in section order and drops empty sections", () => {
    const groups = groupBySection(resolveDocs(all, "en"));
    expect(groups.map((g) => g.section)).toEqual(["start", "reading", "contributing"]);
    expect(groups[1]?.entries.map((e) => e.doc.slug)).toEqual(["c", "b"]);
  });

  it("returns previous/next across the whole ordered list", () => {
    const pages = resolveDocs(all, "en");
    expect(getNeighbours(pages, "a")).toMatchObject({ previous: undefined, next: { doc: { slug: "c" } } });
    expect(getNeighbours(pages, "d")).toMatchObject({ previous: { doc: { slug: "b" } }, next: undefined });
    expect(getNeighbours(pages, "missing")).toEqual({ previous: undefined, next: undefined });
  });
});
