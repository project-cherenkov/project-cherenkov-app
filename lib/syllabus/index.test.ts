import { describe, expect, it } from "vitest";

import { SUBJECTS } from "../subjects";
import {
  SYLLABI,
  getAllSyllabi,
  getSyllabus,
  getTopicCount,
  getSubtopicCount,
  getTopicLocation,
  localize,
  resolveTopicId,
  topicSelectOptions,
} from "./index";

describe("syllabus data", () => {
  it("has exactly one syllabus per subject, keyed by its own subject", () => {
    expect(getAllSyllabi().map((s) => s.subject)).toEqual([...SUBJECTS]);
    for (const subject of SUBJECTS) {
      expect(SYLLABI[subject].subject).toBe(subject);
    }
  });

  it.each(SUBJECTS)("%s: ids are unique, kebab-case, and every name has both locales", (subject) => {
    const { sections } = SYLLABI[subject];
    const sectionIds = sections.map((s) => s.id);
    // Subtopics share the topic id namespace, so one list must be unique.
    const topicIds = sections.flatMap((s) =>
      s.topics.flatMap((t) => [t.id, ...(t.subtopics ?? []).map((sub) => sub.id)]),
    );

    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(new Set(topicIds).size).toBe(topicIds.length);

    const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const id of [...sectionIds, ...topicIds]) expect(id).toMatch(kebab);

    for (const section of sections) {
      expect(section.name.id.trim()).not.toBe("");
      expect(section.name.en.trim()).not.toBe("");
      for (const topic of section.topics) {
        expect(topic.name.id.trim()).not.toBe("");
        expect(topic.name.en.trim()).not.toBe("");
        for (const sub of topic.subtopics ?? []) {
          expect(sub.name.id.trim()).not.toBe("");
          expect(sub.name.en.trim()).not.toBe("");
        }
      }
    }
  });

  it.each(SUBJECTS)("%s: theory sections have topics, practical sections have none", (subject) => {
    for (const section of SYLLABI[subject].sections) {
      if (section.part === "theory") expect(section.topics.length).toBeGreaterThan(0);
      else expect(section.topics).toHaveLength(0);
    }
    expect(getTopicCount(subject)).toBeGreaterThan(0);
  });
});

describe("syllabus helpers", () => {
  it("getSyllabus rejects unknown subjects", () => {
    expect(getSyllabus("physics")?.subject).toBe("physics");
    expect(getSyllabus("chemistry")).toBeUndefined();
  });

  it("getTopicLocation finds a topic and its section, and misses cleanly", () => {
    const found = getTopicLocation("informatics", "binary-search");
    expect(found?.section.id).toBe("searching-sorting");
    expect(getTopicLocation("informatics", "nope")).toBeUndefined();
    expect(getTopicLocation("physics", "binary-search")).toBeUndefined();
  });

  it("localize picks the locale and falls back to Indonesian", () => {
    const name = { id: "Bintang", en: "Stars" };
    expect(localize(name, "en")).toBe("Stars");
    expect(localize(name, "id")).toBe("Bintang");
    expect(localize(name, "fr")).toBe("Bintang");
  });

  it("topicSelectOptions prefixes the section so duplicate names stay distinguishable", () => {
    const labels = topicSelectOptions("informatics").map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("Recursion › Divide and conquer");
    expect(labels).toContain("Problem-Solving Strategies › Divide and conquer");
  });
});

describe("subtopics", () => {
  it("sidereal-synodic-periods is a subtopic of the Solar System topic", () => {
    const found = getTopicLocation("astronomy", "sidereal-synodic-periods");
    expect(found?.subtopic?.id).toBe("sidereal-synodic-periods");
    expect(found?.topic.id).toBe("solar-system-bodies");
    expect(found?.section.id).toBe("solar-system");
  });

  it("a plain topic id has no subtopic, and the helper rolls a subtopic up to its topic", () => {
    expect(getTopicLocation("astronomy", "solar-system-bodies")?.subtopic).toBeUndefined();
    expect(resolveTopicId("astronomy", "sidereal-synodic-periods")).toBe("solar-system-bodies");
    expect(resolveTopicId("astronomy", "solar-system-bodies")).toBe("solar-system-bodies");
    expect(resolveTopicId("astronomy", "nope")).toBeUndefined();
    expect(resolveTopicId("physics", "sidereal-synodic-periods")).toBeUndefined();
  });

  it("subtopics are not counted as topics", () => {
    expect(getSubtopicCount("astronomy")).toBeGreaterThanOrEqual(1);
    expect(getSubtopicCount("informatics")).toBe(0);
  });

  it("topicSelectOptions lists a subtopic right after its topic, with the full path", () => {
    const options = topicSelectOptions("astronomy");
    const i = options.findIndex((o) => o.value === "solar-system-bodies");
    expect(options[i + 1]).toEqual({
      label: "Solar System › The Solar System › Sidereal and synodic periods",
      value: "sidereal-synodic-periods",
    });
  });
});

describe("syllabus sources", () => {
  it.each(SUBJECTS)("%s: a source URL is https and a checked date is a real ISO date", (subject) => {
    const { source } = SYLLABI[subject];
    if (source.url) expect(source.url).toMatch(/^https:\/\//);
    if (source.accessed) {
      expect(source.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(source.accessed))).toBe(false);
    }
  });

  it("astronomy follows the senior IOAA syllabus, not the Junior one", () => {
    const { source } = SYLLABI.astronomy;
    expect(source.label).not.toMatch(/junior/i);
    expect(source.url ?? "").not.toMatch(/junior/i);
    // Topics that exist only in the senior syllabus.
    for (const id of ["nuclear-physics", "interstellar-medium", "accretion-processes"]) {
      expect(getTopicLocation("astronomy", id), id).toBeDefined();
    }
    // Topic ids the planner and quiz bank already depend on stay valid.
    for (const id of ["celestial-mechanics", "exoplanets", "space-exploration", "instrumentation"]) {
      expect(getTopicLocation("astronomy", id), id).toBeDefined();
    }
  });

  it("astronomy has the senior syllabus's practical part", () => {
    const practical = SYLLABI.astronomy.sections.filter((s) => s.part === "practical");
    expect(practical.map((s) => s.id)).toEqual(["practical-observations", "practical-data-analysis"]);
  });
});
