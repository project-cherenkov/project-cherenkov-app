import { describe, expect, it, vi } from "vitest";

import { loadSubjectMastery } from "./progress-data";
import type { PlanReadDeps } from "./plan-state";

const NOW = new Date("2026-10-20T00:00:00Z");

function deps(over: Partial<PlanReadDeps> = {}): PlanReadDeps {
  return {
    getSettings: vi.fn().mockResolvedValue(null),
    getSubjectTopics: vi.fn().mockResolvedValue([
      { id: "row-1", syllabusTopicId: "vectors", sectionId: "s", order: 1 },
      { id: "row-2", syllabusTopicId: "kinematics", sectionId: "s", order: 2 },
    ]),
    getSelfRatings: vi.fn().mockResolvedValue(new Map()),
    getAnswers: vi.fn().mockResolvedValue([]),
    getTopicsWithQuestions: vi.fn().mockResolvedValue(new Set()),
    ...over,
  };
}

describe("loadSubjectMastery", () => {
  it("returns nothing when the subject has no planner topic rows", async () => {
    const result = await loadSubjectMastery(
      deps({ getSubjectTopics: vi.fn().mockResolvedValue([]) }),
      "u1", "physics", "osn_p", NOW,
    );
    expect(result.estimates.size).toBe(0);
  });

  it("keys estimates by syllabus topic id and leaves unanswered topics unverified", async () => {
    const answeredAt = new Date("2026-10-19T00:00:00Z");
    const result = await loadSubjectMastery(
      deps({
        getAnswers: vi.fn().mockResolvedValue([
          { topicId: "row-1", correct: true, answeredAt },
          { topicId: "row-1", correct: true, answeredAt },
          { topicId: "row-1", correct: true, answeredAt },
        ]),
      }),
      "u1", "physics", "osn_k", NOW,
    );
    expect(result.estimates.get("vectors")).toMatchObject({ answerCount: 3 });
    expect(result.estimates.get("vectors")!.status).not.toBe("unverified");
    expect(result.estimates.get("kinematics")).toMatchObject({ status: "unverified", answerCount: 0 });
  });

  it("only counts answers at the difficulties the stage draws from", async () => {
    const getAnswers = vi.fn().mockResolvedValue([]);
    await loadSubjectMastery(deps({ getAnswers }), "u1", "physics", "osn_k", NOW);
    expect(getAnswers).toHaveBeenCalledWith("u1", ["row-1", "row-2"], ["basic", "intermediate"]);
  });
});
