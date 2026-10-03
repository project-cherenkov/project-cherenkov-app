import { describe, expect, it } from "vitest";

import { buildSubjectCoverage, getSectionNeighbours, type EditorialRef, type MaterialRef } from "./library";
import type { SubjectSyllabus } from "./syllabus";

const name = (en: string) => ({ id: en, en });

const syllabus: SubjectSyllabus = {
  subject: "informatics",
  sourceLang: "en",
  source: { label: "fixture" },
  sections: [
    {
      id: "s1", part: "theory", name: name("S1"),
      topics: [
        { id: "a", name: name("A") },
        { id: "b", name: name("B") },
        { id: "c", name: name("C") },
      ],
    },
    { id: "s2", part: "theory", name: name("S2"), topics: [{ id: "d", name: name("D") }] },
    { id: "p1", part: "practical", name: name("P1"), topics: [], note: "x" },
  ],
};

const material = (topic: string, slug = topic, subject = "informatics"): MaterialRef => ({
  subject, slug, title: `Material ${slug}`, topic,
});
const editorial = (slug: string, syllabusTopic?: string, subject = "informatics"): EditorialRef => ({
  subject, slug, title: slug, syllabusTopic,
});

describe("buildSubjectCoverage", () => {
  it("attaches each material and editorial to its topic and counts them", () => {
    const result = buildSubjectCoverage(
      syllabus,
      [material("a"), material("c")],
      [editorial("e1", "a"), editorial("e2", "a"), editorial("e3", "d"), editorial("e4")],
    );

    expect(result.topicCount).toBe(4);
    expect(result.materialCount).toBe(2);
    expect(result.editorialCount).toBe(3);
    expect(result.sections[0]!.topics[0]!.editorials.map((e) => e.slug)).toEqual(["e1", "e2"]);
    expect(result.sections[0]!.topics[1]!.material).toBeUndefined();
  });

  it("ignores other subjects' content, even when topic ids collide", () => {
    const result = buildSubjectCoverage(
      syllabus,
      [material("a", "a", "physics")],
      [editorial("e1", "a", "astronomy")],
    );
    expect(result.materialCount).toBe(0);
    expect(result.editorialCount).toBe(0);
  });

  it("picks the alphabetically first material when two claim one topic", () => {
    const result = buildSubjectCoverage(syllabus, [material("a", "z-late"), material("a", "a-early")], []);
    expect(result.sections[0]!.topics[0]!.material?.slug).toBe("a-early");
  });

  it("keeps practical sections (with no topics) in the output", () => {
    const result = buildSubjectCoverage(syllabus, [], []);
    expect(result.sections.map((s) => s.section.id)).toEqual(["s1", "s2", "p1"]);
  });
});

describe("getSectionNeighbours", () => {
  const coverage = buildSubjectCoverage(syllabus, [material("a"), material("c"), material("d")], []);

  it("walks only topics that have a material, within the same section", () => {
    expect(getSectionNeighbours(coverage, "a")).toEqual({ previous: undefined, next: coverage.sections[0]!.topics[2]!.material });
    expect(getSectionNeighbours(coverage, "c").previous?.topic).toBe("a");
    expect(getSectionNeighbours(coverage, "c").next).toBeUndefined();
  });

  it("does not cross into the next section", () => {
    expect(getSectionNeighbours(coverage, "d")).toEqual({ previous: undefined, next: undefined });
  });

  it("returns nothing for an unknown topic", () => {
    expect(getSectionNeighbours(coverage, "zzz")).toEqual({});
  });
});
