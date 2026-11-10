import { describe, expect, it } from "vitest";

import { SUBJECTS } from "../subjects";
import {
  SYLLABI,
  describeTopicCoverage,
  getAllSyllabi,
  getPlannerSyllabus,
  getPlannerTopicCount,
  getPlannerTopicLocation,
  getPrimarySource,
  getSyllabus,
  getTopicCount,
  sectionSourceIds,
  topicLanguage,
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
  it.each(SUBJECTS)("%s: source URLs are https and checked dates are real ISO dates", (subject) => {
    for (const source of SYLLABI[subject].sources) {
      if (source.url) expect(source.url, source.id).toMatch(/^https:\/\//);
      if (source.accessed) {
        expect(source.accessed, source.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(Date.parse(source.accessed)), source.id).toBe(false);
      }
    }
  });

  it.each(SUBJECTS)("%s: source ids are unique, kebab-case and described in both locales", (subject) => {
    const ids = SYLLABI[subject].sources.map((source) => source.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const source of SYLLABI[subject].sources) {
      expect(source.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(source.short.trim(), source.id).not.toBe("");
      expect(source.label.trim(), source.id).not.toBe("");
      expect(source.issuer.trim(), source.id).not.toBe("");
      if (source.note) {
        expect(source.note.id.trim(), source.id).not.toBe("");
        expect(source.note.en.trim(), source.id).not.toBe("");
      }
    }
  });

  it.each(SUBJECTS)("%s: every topic names at least one registered source", (subject) => {
    const registered = new Set(SYLLABI[subject].sources.map((source) => source.id));
    for (const section of SYLLABI[subject].sections) {
      for (const entry of section.topics) {
        expect(entry.in.length, entry.id).toBeGreaterThan(0);
        expect(new Set(entry.in).size, entry.id).toBe(entry.in.length);
        for (const id of entry.in) expect(registered.has(id), `${entry.id} -> ${id}`).toBe(true);
        // A reference only makes sense for a source the topic is listed in.
        for (const [id, ref] of Object.entries(entry.refs ?? {})) {
          expect(entry.in, `${entry.id} ref ${id}`).toContain(id);
          expect(ref.trim(), `${entry.id} ref ${id}`).not.toBe("");
        }
      }
      for (const id of section.in ?? []) expect(registered.has(id), `${section.id} -> ${id}`).toBe(true);
      if (section.part === "practical") expect((section.in ?? []).length, section.id).toBeGreaterThan(0);
    }
  });

  it.each(SUBJECTS)("%s: a source marked unchecked carries no checked date, and a compared one does", (subject) => {
    for (const source of SYLLABI[subject].sources) {
      if (source.verification === "compared") expect(source.accessed, source.id).toBeDefined();
      else expect(source.accessed, source.id).toBeUndefined();
    }
  });

  it("the primary source is the one the planner is built on", () => {
    expect(getPrimarySource(SYLLABI.physics).id).toBe("osn");
    expect(getPrimarySource(SYLLABI.informatics).id).toBe("osn");
    expect(getPrimarySource(SYLLABI.astronomy).id).toBe("ioaa");
  });

  it("topic language follows the topic's first source", () => {
    const physics = SYLLABI.physics;
    expect(topicLanguage(physics, getTopicLocation("physics", "kinematics")!.topic)).toBe("id");
    expect(topicLanguage(physics, getTopicLocation("physics", "relativity")!.topic)).toBe("en");
    expect(topicLanguage(SYLLABI.astronomy, getTopicLocation("astronomy", "celestial-mechanics")!.topic)).toBe("en");
  });

  it("astronomy follows the senior IOAA syllabus, not the Junior one", () => {
    const [source] = SYLLABI.astronomy.sources;
    expect(source!.label).not.toMatch(/junior/i);
    expect(source!.url ?? "").not.toMatch(/junior/i);
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

// The ids the planner, quiz bank, editorials and materials already point at.
// Adding sources must never rename or drop one. Add to this list, never edit it.
const FROZEN_OSN_TOPIC_IDS: Record<string, string[]> = {
  physics: [
    "vectors", "kinematics", "statics", "dynamics", "energy-momentum", "rotation-rigid-body",
    "gravitation", "fluids", "oscillations", "waves", "electrostatics", "magnetostatics",
    "circuits", "electrodynamics", "heat-temperature", "entropy", "laws-of-thermodynamics",
  ],
};

describe("syllabus membership", () => {
  it("existing physics topic ids are unchanged and still in the OSN source", () => {
    for (const id of FROZEN_OSN_TOPIC_IDS.physics!) {
      const located = getTopicLocation("physics", id);
      expect(located, id).toBeDefined();
      expect(located!.topic.in, id).toContain("osn");
    }
  });

  it("IPhO-only physics topics are not OSN topics and cannot reach the planner", () => {
    for (const id of ["relativity", "interference-diffraction", "calculus", "statistical-physics"]) {
      const located = getTopicLocation("physics", id);
      expect(located!.topic.in, id).toEqual(["ipho"]);
      expect(getPlannerTopicLocation("physics", id), id).toBeUndefined();
    }
    const planner = getPlannerSyllabus("physics")!;
    const ids = planner.sections.flatMap((s) => s.topics.map((t) => t.id));
    expect(ids).toHaveLength(FROZEN_OSN_TOPIC_IDS.physics!.length);
    expect(ids).not.toContain("relativity");
    expect(getPlannerTopicCount("physics")).toBe(ids.length);
    // Sections with nothing left are dropped from the planner view.
    expect(planner.sections.some((s) => s.id === "optics")).toBe(false);
  });

  it("the planner view of informatics and astronomy is the whole syllabus", () => {
    for (const subject of ["informatics", "astronomy"] as const) {
      expect(getPlannerTopicCount(subject)).toBe(getTopicCount(subject));
    }
  });

  it("describeTopicCoverage reports the sources that list a topic", () => {
    const physics = SYLLABI.physics;
    const kinematics = describeTopicCoverage(physics, getTopicLocation("physics", "kinematics")!.topic);
    expect(kinematics.listedIn.map((s) => s.id)).toEqual(["osn", "ipho"]);
    expect(kinematics.inPrimary).toBe(true);
    const relativity = describeTopicCoverage(physics, getTopicLocation("physics", "relativity")!.topic);
    expect(relativity.listedIn.map((s) => s.id)).toEqual(["ipho"]);
    expect(relativity.inPrimary).toBe(false);
  });

  it("IOI is named only for informatics topics the IOI text lists, with a code", () => {
    for (const section of SYLLABI.informatics.sections) {
      for (const entry of section.topics) {
        if (entry.in.includes("ioi")) expect(entry.refs?.ioi, entry.id).toBeDefined();
      }
    }
    // Left as OSN-only on purpose: the IOI text does not name them as included.
    for (const id of ["number-theory", "probability", "simple-sorts", "weighted-graphs", "modular-exponentiation"]) {
      expect(getTopicLocation("informatics", id)!.topic.in, id).toEqual(["osn"]);
    }
  });

  it("sectionSourceIds is computed from topics, or from the section for a practical one", () => {
    const optics = SYLLABI.physics.sections.find((s) => s.id === "optics")!;
    expect(sectionSourceIds(SYLLABI.physics, optics)).toEqual(["ipho"]);
    const mechanics = SYLLABI.physics.sections.find((s) => s.id === "mechanics")!;
    expect(sectionSourceIds(SYLLABI.physics, mechanics)).toEqual(["osn", "ipho"]);
    const skills = SYLLABI.physics.sections.find((s) => s.id === "practical-experimental-skills")!;
    expect(sectionSourceIds(SYLLABI.physics, skills)).toEqual(["ipho"]);
  });
});
