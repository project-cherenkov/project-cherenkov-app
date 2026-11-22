import { describe, expect, it } from "vitest";
import { loadPlanningState, type PlanReadDeps, type PlanTopicRow } from "./plan-state";
import type { PlannerSettings } from "./planner-settings";
import { getPlannerSyllabus } from "./syllabus";

const NOW = new Date("2026-10-04T05:00:00Z");
const settings: PlannerSettings = {
  subject: "physics",
  stage: "osn_k",
  examYear: 2027,
  hoursPerWeek: 6,
  timezone: "Asia/Jakarta",
};

const expectedIds = getPlannerSyllabus("physics")!.sections.flatMap((section) =>
  section.topics.map((topic) => topic.id),
);

function rows(ids: string[]): PlanTopicRow[] {
  return ids.map((syllabusTopicId, order) => ({
    id: `row-${order}`,
    syllabusTopicId,
    sectionId: null,
    order,
  }));
}

function deps(subjectRows: PlanTopicRow[]): PlanReadDeps {
  return {
    getSettings: async () => settings,
    getSubjectTopics: async () => subjectRows,
    getSelfRatings: async () => new Map(),
    getAnswers: async () => [],
    getTopicsWithQuestions: async () => new Set(),
  };
}

describe("loadPlanningState — current planner syllabus coverage", () => {
  it("marks the topic data complete when every current planner topic is seeded", async () => {
    const state = await loadPlanningState(deps(rows(expectedIds)), "u1", NOW);

    expect(state?.topicCoverageComplete).toBe(true);
    expect(state?.topics).toHaveLength(expectedIds.length);
  });

  it("filters obsolete and non-primary-source rows and detects partial coverage", async () => {
    const sourceRows = rows([
      ...expectedIds.slice(1),
      "relativity", // valid in the full physics syllabus, but not the planner source
      "obsolete-topic-id", // no longer in the syllabus at all
    ]);
    const state = await loadPlanningState(deps(sourceRows), "u1", NOW);

    expect(state?.topicCoverageComplete).toBe(false);
    expect(state?.topics.map((topic) => topic.row.syllabusTopicId)).not.toContain("relativity");
    expect(state?.topics.map((topic) => topic.row.syllabusTopicId)).not.toContain("obsolete-topic-id");
    expect(state?.topics).toHaveLength(expectedIds.length - 1);
  });

  it("reports incomplete coverage when no topic rows are seeded", async () => {
    const state = await loadPlanningState(deps([]), "u1", NOW);

    expect(state?.topicCoverageComplete).toBe(false);
    expect(state?.topics).toEqual([]);
  });

  it("filters the obsolete Astronomy cosmonautics row and flags the missing current catalogue", async () => {
    const astronomySettings: PlannerSettings = { ...settings, subject: "astronomy" };
    const astronomyIds = getPlannerSyllabus("astronomy")!.sections.flatMap((section) =>
      section.topics.map((topic) => topic.id),
    );
    const currentRows = rows(astronomyIds.filter((id) => id !== "nuclear-physics"));
    const legacyRows = [...currentRows, ...rows(["cosmonautics"]).map((row, index) => ({
      ...row,
      id: `legacy-${index}`,
      order: astronomyIds.length + index,
    }))];
    const state = await loadPlanningState(
      {
        ...deps(legacyRows),
        getSettings: async () => astronomySettings,
      },
      "u1",
      NOW,
    );

    expect(state?.topicCoverageComplete).toBe(false);
    expect(state?.topics.map((topic) => topic.row.syllabusTopicId)).not.toContain("cosmonautics");
    expect(state?.topics.map((topic) => topic.row.syllabusTopicId)).not.toContain("nuclear-physics");
    expect(state?.topics).toHaveLength(astronomyIds.length - 1);
  });
});
