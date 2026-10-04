import { describe, expect, it } from "vitest";
import { getAllSyllabi, getTopicCount } from "../syllabus";
import { SUBJECTS } from "../subjects";
import { practical, section, topic } from "../syllabus/define";
import type { SubjectSyllabus } from "../syllabus/types";
import { deriveSyllabusTopics } from "./derive-syllabus-topics";

const TINY: SubjectSyllabus = {
  subject: "physics",
  sourceLang: "id",
  source: { label: "test" },
  sections: [
    section("a", "Bagian A", "Section A", [
      topic("a1", "A satu", "A one"),
      topic("a2", "A dua", "A two"),
    ]),
    practical("p", "Praktikum", "Practical", "note"),
    section("b", "Bagian B", "Section B", [topic("b1", "B satu", "B one")]),
  ],
};

describe("deriveSyllabusTopics", () => {
  it("emits one row per theory topic, in syllabus order, skipping practical sections", () => {
    const rows = deriveSyllabusTopics([TINY], []);
    expect(rows.map((r) => [r.syllabusTopicId, r.sectionId, r.order])).toEqual([
      ["a1", "a", 0],
      ["a2", "a", 1],
      ["b1", "b", 2],
    ]);
    expect(rows[0]).toMatchObject({
      subject: "physics",
      chapter: "Bagian A",
      title: "A satu",
      editorialSlug: null,
    });
  });

  it("links the earliest-published editorial that points at a topic", () => {
    const rows = deriveSyllabusTopics(
      [TINY],
      [
        { subject: "physics", slug: "later", publishedAt: "2026-09-01", syllabusTopic: "a1" },
        { subject: "physics", slug: "earlier", publishedAt: "2026-08-01", syllabusTopic: "a1" },
        { subject: "physics", slug: "other", publishedAt: "2026-08-01", syllabusTopic: "b1" },
        { subject: "physics", slug: "unlinked", publishedAt: "2026-08-01" },
      ],
    );
    expect(rows.find((r) => r.syllabusTopicId === "a1")?.editorialSlug).toBe("earlier");
    expect(rows.find((r) => r.syllabusTopicId === "b1")?.editorialSlug).toBe("other");
    expect(rows.find((r) => r.syllabusTopicId === "a2")?.editorialSlug).toBeNull();
  });

  it("breaks a publication-date tie by slug, so the result is deterministic", () => {
    const eds = [
      { subject: "physics" as const, slug: "zzz", publishedAt: "2026-08-01", syllabusTopic: "a1" },
      { subject: "physics" as const, slug: "aaa", publishedAt: "2026-08-01", syllabusTopic: "a1" },
    ];
    expect(deriveSyllabusTopics([TINY], eds)[0]?.editorialSlug).toBe("aaa");
    expect(deriveSyllabusTopics([TINY], [...eds].reverse())[0]?.editorialSlug).toBe("aaa");
  });

  it("does not link an editorial from another subject that reuses a topic id", () => {
    const rows = deriveSyllabusTopics(
      [TINY],
      [{ subject: "astronomy", slug: "x", publishedAt: "2026-08-01", syllabusTopic: "a1" }],
    );
    expect(rows[0]?.editorialSlug).toBeNull();
  });
});

describe("deriveSyllabusTopics on the real syllabus", () => {
  const rows = deriveSyllabusTopics(getAllSyllabi(), []);

  it("covers every theory topic of every subject", () => {
    for (const subject of SUBJECTS) {
      expect(rows.filter((r) => r.subject === subject)).toHaveLength(getTopicCount(subject));
    }
  });

  it("has unique (subject, syllabusTopicId) keys and gap-free order per subject", () => {
    const keys = rows.map((r) => `${r.subject}/${r.syllabusTopicId}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const subject of SUBJECTS) {
      const orders = rows.filter((r) => r.subject === subject).map((r) => r.order);
      expect(orders).toEqual(orders.map((_, i) => i));
    }
  });
});
