import { describe, expect, it } from "vitest";

import { SUBJECTS } from "../subjects";
import {
  SYLLABI,
  getAllSyllabi,
  getSyllabus,
  getTopicCount,
  getTopicLocation,
  localize,
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
    const topicIds = sections.flatMap((s) => s.topics.map((t) => t.id));

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
