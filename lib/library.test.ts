import { describe, expect, it } from "vitest";

import { buildSubjectCoverage, findCoverageEntry, getSectionNeighbours, type EditorialRef, type MaterialRef } from "./library";
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

describe("subtopics", () => {
  const sub: SubjectSyllabus = {
    ...syllabus,
    sections: [
      {
        id: "s1", part: "theory", name: name("S1"),
        topics: [
          { id: "a", name: name("A") },
          { id: "b", name: name("B"), subtopics: [{ id: "b1", name: name("B1") }, { id: "b2", name: name("B2") }] },
          { id: "c", name: name("C") },
        ],
      },
    ],
  };

  it("attaches content to a subtopic without counting it on the parent", () => {
    const result = buildSubjectCoverage(sub, [material("b1"), material("c")], [editorial("e1", "b1"), editorial("e2", "b")]);
    const b = result.sections[0]!.topics[1]!;
    expect(b.material).toBeUndefined();
    expect(b.editorials.map((e) => e.slug)).toEqual(["e2"]);
    expect(b.subtopics[0]!.material?.slug).toBe("b1");
    expect(b.subtopics[0]!.editorials.map((e) => e.slug)).toEqual(["e1"]);
    expect(result.topicCount).toBe(3);
    expect(result.subtopicCount).toBe(2);
    expect(result.materialCount).toBe(2);
    expect(result.editorialCount).toBe(2);
  });

  it("covers a topic once however many of its subtopics have materials", () => {
    const result = buildSubjectCoverage(sub, [material("b1"), material("b2"), material("b")], []);
    expect(result.materialCount).toBe(3);
    expect(result.coveredTopicCount).toBe(1);
    expect(buildSubjectCoverage(sub, [], []).coveredTopicCount).toBe(0);
  });

  it("findCoverageEntry finds a topic or a subtopic", () => {
    const result = buildSubjectCoverage(sub, [], []);
    expect(findCoverageEntry(result, "b2")?.subtopic?.subtopic.id).toBe("b2");
    expect(findCoverageEntry(result, "b2")?.topic.topic.id).toBe("b");
    expect(findCoverageEntry(result, "c")?.subtopic).toBeUndefined();
    expect(findCoverageEntry(result, "zzz")).toBeUndefined();
  });

  it("previous/next walks a topic's materials, then its subtopics', in order", () => {
    const result = buildSubjectCoverage(sub, [material("a"), material("b1"), material("b2"), material("c")], []);
    expect(getSectionNeighbours(result, "b1").previous?.slug).toBe("a");
    expect(getSectionNeighbours(result, "b1").next?.slug).toBe("b2");
    expect(getSectionNeighbours(result, "b2").next?.slug).toBe("c");
    expect(getSectionNeighbours(result, "c").previous?.slug).toBe("b2");
  });
});
