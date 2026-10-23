import { describe, expect, it } from "vitest";

import { buildSearchIndex, searchEntries, tokenize, type SearchSources } from "./search";
import type { SubjectSyllabus } from "./syllabus";

const syllabus = {
  subject: "informatics",
  sourceLang: "en",
  source: { label: "t" },
  sections: [
    {
      id: "algo",
      name: { en: "Algorithms", id: "Algoritma" },
      part: "theory",
      topics: [
        { id: "binary-search", name: { en: "Binary search", id: "Pencarian biner" } },
        { id: "sorting", name: { en: "Sorting", id: "Pengurutan" }, detail: "merge sort, quicksort" },
      ],
    },
  ],
} as SubjectSyllabus;

const sources: SearchSources = {
  syllabi: [syllabus],
  materials: [
    { subject: "informatics", slug: "binary-search", title: "Binary search", summary: "Halve the search space.", topic: "binary-search" },
  ],
  editorials: [
    {
      subject: "informatics",
      slug: "binary-search-on-answer",
      title: "Binary search on the answer",
      hook: "Binary search needs a monotonic predicate.",
      tags: ["monotonic-predicate", "searching"],
      principle: "monotonic-predicate-search",
      errorType: "assumed-sortedness-instead-of-monotonicity",
      syllabusTopic: "binary-search",
    },
    {
      subject: "physics",
      slug: "projectile-range-symmetry",
      title: "Projectile range symmetry",
      hook: "Two launch angles, one range.",
      tags: ["projectile"],
      principle: "symmetry",
    },
  ],
  docs: [{ slug: "getting-started", title: "Getting started", description: "How to use the site." }],
};

describe("tokenize", () => {
  it("lowercases, strips accents and splits on punctuation", () => {
    expect(tokenize("Café-au-lait, 3D!")).toEqual(["cafe", "au", "lait", "3d"]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("buildSearchIndex", () => {
  const index = buildSearchIndex(sources, "en");

  it("indexes editorials, materials, docs and syllabus topics", () => {
    expect(index.map((e) => e.kind).sort()).toEqual(["doc", "editorial", "editorial", "material", "topic"]);
  });

  it("lists a topic only when it has no material (the material carries its name)", () => {
    const topics = index.filter((e) => e.kind === "topic");
    expect(topics.map((t) => t.title)).toEqual(["Sorting"]);
  });

  it("localizes syllabus names", () => {
    const id = buildSearchIndex(sources, "id");
    expect(id.find((e) => e.kind === "topic")!.title).toBe("Pengurutan");
    expect(id.find((e) => e.kind === "material")!.keywords).toContain("Pencarian biner");
  });

  it("builds locale-less paths", () => {
    const hrefs = Object.fromEntries(index.map((e) => [e.id, e.href]));
    expect(hrefs["editorial:informatics/binary-search-on-answer"]).toBe("/archive/informatics/binary-search-on-answer");
    expect(hrefs["material:informatics/binary-search"]).toBe("/materials/informatics/binary-search");
    expect(hrefs["topic:informatics/sorting"]).toBe("/syllabus/informatics#topic-sorting");
    expect(hrefs["doc:getting-started"]).toBe("/docs/getting-started");
  });
});

describe("searchEntries", () => {
  const index = buildSearchIndex(sources, "en");
  const titles = (q: string) => searchEntries(index, q).map((h) => h.entry.title);

  it("returns nothing for an empty or punctuation-only query", () => {
    expect(titles("")).toEqual([]);
    expect(titles("  ?! ")).toEqual([]);
  });

  it("matches by title prefix, ignoring case and accents", () => {
    expect(titles("BINAR")).toContain("Binary search");
    expect(titles("pro")).toContain("Projectile range symmetry");
  });

  it("finds editorials by tag, principle and error type, not only title", () => {
    expect(titles("monotonic")).toContain("Binary search on the answer");
    expect(titles("sortedness")).toContain("Binary search on the answer");
    expect(titles("searching")).toContain("Binary search on the answer");
  });

  it("finds a material by its topic's name in another language", () => {
    const id = buildSearchIndex(sources, "id");
    expect(searchEntries(id, "biner").map((h) => h.entry.title)).toContain("Binary search");
  });

  it("requires every typed word to match", () => {
    expect(titles("binary projectile")).toEqual([]);
    expect(titles("binary answer")).toEqual(["Binary search on the answer"]);
  });

  it("ranks title matches above summary-only matches", () => {
    const hits = searchEntries(index, "search");
    expect(hits[0]!.entry.title).toMatch(/^Binary search/);
    // the doc mentions neither; the editorial hook and material summary match only weakly
    expect(hits.every((h) => h.score > 0)).toBe(true);
  });

  it("puts an exact phrase in the title first, then breaks ties by kind", () => {
    const hits = searchEntries(index, "binary search");
    expect(hits.map((h) => h.entry.kind)).toEqual(["material", "editorial"]);
  });

  it("finds a syllabus topic by its detail text", () => {
    expect(titles("quicksort")).toEqual(["Sorting"]);
  });

  it("honours the result limit", () => {
    expect(searchEntries(index, "s", 2)).toHaveLength(2);
  });
});
