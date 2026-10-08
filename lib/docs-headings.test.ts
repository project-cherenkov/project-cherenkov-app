import { describe, expect, it } from "vitest";

import { createSlugger, extractToc, rehypeHeadingIds, slugify } from "./docs-headings";

describe("slugify", () => {
  it("lowercases, strips punctuation and hyphenates spaces", () => {
    expect(slugify("The Anatomy of an Editorial")).toBe("the-anatomy-of-an-editorial");
    expect(slugify("What's new? (2026)")).toBe("whats-new-2026");
  });

  it("keeps non-ASCII letters (Indonesian and beyond)", () => {
    expect(slugify("Pengantar Fisika")).toBe("pengantar-fisika");
    expect(slugify("Ünïcödé")).toBe("ünïcödé");
  });
});

describe("createSlugger", () => {
  it("suffixes repeated headings like GitHub does", () => {
    const slug = createSlugger();
    expect([slug("Notes"), slug("Notes"), slug("Notes")]).toEqual(["notes", "notes-1", "notes-2"]);
  });

  it("never returns an empty id", () => {
    expect(createSlugger()("???")).toBe("section");
  });
});

describe("extractToc", () => {
  it("returns h2 and h3 only, in order, with ids", () => {
    const toc = extractToc("# Title\n\n## One\n\ntext\n\n### Two\n\n#### Deep\n\n## Three");
    expect(toc).toEqual([
      { depth: 2, title: "One", id: "one" },
      { depth: 3, title: "Two", id: "two" },
      { depth: 2, title: "Three", id: "three" },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const toc = extractToc("## Real\n\n```md\n## Not a heading\n```\n\n~~~\n## Nor this\n~~~\n\n## Also real");
    expect(toc.map((e) => e.title)).toEqual(["Real", "Also real"]);
  });

  it("strips inline markdown from titles", () => {
    const toc = extractToc("## The `vizConfig` **shape** and [a link](/x)");
    expect(toc[0]).toEqual({ depth: 2, title: "The vizConfig shape and a link", id: "the-vizconfig-shape-and-a-link" });
  });

  it("de-duplicates ids across depths, in document order", () => {
    const toc = extractToc("## Notes\n\n### Notes\n\n#### Notes\n\n## Notes");
    // The h4 consumes a slug even though it isn't listed, matching the rehype pass.
    expect(toc.map((e) => e.id)).toEqual(["notes", "notes-1", "notes-3"]);
  });
});

describe("rehypeHeadingIds", () => {
  const text = (value: string) => ({ type: "text", value });
  const heading = (tagName: string, ...children: unknown[]) => ({
    type: "element",
    tagName,
    properties: {},
    children,
  });

  it("stamps ids on h2–h6, reading text through nested elements", () => {
    const h2 = heading("h2", text("The "), { type: "element", tagName: "code", children: [text("vizConfig")] });
    const h1 = heading("h1", text("Title"));
    const tree = { type: "root", children: [h1, h2, heading("h3", text("Sub"))] };
    rehypeHeadingIds()(tree as never);
    expect(h2.properties).toMatchObject({ id: "the-vizconfig" });
    expect(h1.properties).not.toHaveProperty("id"); // h1 is the page title, not a section
  });

  it("agrees with extractToc for the same document", () => {
    const md = "## Notes\n\n### Notes\n\n## Other";
    const hast = {
      type: "root",
      children: [heading("h2", text("Notes")), heading("h3", text("Notes")), heading("h2", text("Other"))],
    };
    rehypeHeadingIds()(hast as never);
    const ids = (hast.children as unknown as { properties: { id: string } }[]).map((h) => h.properties.id);
    expect(ids).toEqual(extractToc(md).map((e) => e.id));
  });

  it("leaves an id an author set explicitly", () => {
    const h = { type: "element", tagName: "h2", properties: { id: "custom" }, children: [text("X")] };
    rehypeHeadingIds()({ type: "root", children: [h] } as never);
    expect(h.properties.id).toBe("custom");
  });
});
