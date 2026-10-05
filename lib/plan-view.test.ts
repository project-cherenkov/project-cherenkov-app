import { describe, expect, it } from "vitest";
import { buildPlannerPageData, buildTodayList, groupItemsByWeek, type ItemView, type PlanViewDeps } from "./plan-view";
import type { PlannerSettings } from "./planner-settings";
import type { PlanSummary } from "./planner-vocab";

const NOW = new Date("2026-10-04T05:00:00Z");
const settings: PlannerSettings = { subject: "physics", stage: "osn_k", examYear: 2027, hoursPerWeek: 6, timezone: "Asia/Jakarta" };
const summary: PlanSummary = {
  subject: "physics", stage: "osn_k", examYear: 2027, examDate: "2027-06-18", hoursPerWeek: 6, feasible: true,
  requiredMinutes: 100, availableMinutes: 1000, shortfallMinutes: 0, windowDays: 257, bufferDays: 7,
  droppedTopicIds: [], calibrationOffset: 0, topicsWithoutQuiz: 0,
};

function deps(over: Partial<PlanViewDeps> = {}): PlanViewDeps {
  return {
    getSettings: async () => settings,
    getSubjectTopics: async () => [{ id: "t1", syllabusTopicId: "kinematics", sectionId: null, order: 0 }],
    getSelfRatings: async () => new Map(),
    getAnswers: async () => [],
    getTopicsWithQuestions: async () => new Set(),
    getPlan: async () => null,
    getPlanItems: async () => [],
    getLatestAttemptAt: async () => null,
    ...over,
  };
}

const item = (id: string, scheduledFor: string, over: Partial<ItemView> = {}): ItemView => ({
  id, topicId: "t1", title: id, sectionName: "S", kind: "study", reason: null, minutes: 30, scheduledFor, position: 0, done: false, ...over,
});

describe("buildPlannerPageData", () => {
  it("asks for settings first", async () => {
    const d = await buildPlannerPageData(deps({ getSettings: async () => null }), "u", NOW, "en");
    expect(d.state).toBe("needs_settings");
  });

  it("asks for ratings when there is no plan", async () => {
    const d = await buildPlannerPageData(deps(), "u", NOW, "en");
    expect(d.state).toBe("needs_plan");
  });

  it("treats a Phase 2 plan (no summary) as needing a new plan", async () => {
    const d = await buildPlannerPageData(
      deps({ getPlan: async () => ({ id: "p", generatedAt: NOW, targetExamDate: "2027-01-01", summary: null }) }), "u", NOW, "en");
    expect(d.state).toBe("needs_plan");
  });

  it("treats a plan for another subject as needing a new plan", async () => {
    const d = await buildPlannerPageData(
      deps({ getPlan: async () => ({ id: "p", generatedAt: NOW, targetExamDate: "x", summary: { ...summary, subject: "astronomy" } }) }),
      "u", NOW, "en");
    expect(d.state).toBe("needs_plan");
  });

  it("flags a plan as stale after a later quiz attempt or a settings change", async () => {
    const d = await buildPlannerPageData(
      deps({
        getSettings: async () => ({ ...settings, hoursPerWeek: 9 }),
        getPlan: async () => ({ id: "p", generatedAt: new Date("2026-10-01T00:00:00Z"), targetExamDate: "x", summary }),
        getLatestAttemptAt: async () => new Date("2026-10-03T00:00:00Z"),
      }), "u", NOW, "en");
    expect(d.state).toBe("plan");
    if (d.state === "plan") {
      expect(d.staleSinceQuiz).toBe(true);
      expect(d.settingsChanged).toBe(true);
      expect(d.topics[0]!.title).toBe("Kinematics"); // localized from the syllabus
    }
  });
});

describe("buildTodayList", () => {
  it("lists overdue (not done) and today's items", () => {
    const list = buildTodayList([item("a", "2026-10-02"), item("b", "2026-10-02", { done: true }), item("c", "2026-10-04")], "2026-10-04");
    expect(list.overdue.map((i) => i.id)).toEqual(["a"]);
    expect(list.today.map((i) => i.id)).toEqual(["c"]);
    expect(list.upNext).toEqual([]);
  });

  it("pulls the next day forward when everything due is done", () => {
    const list = buildTodayList([item("c", "2026-10-04", { done: true }), item("d", "2026-10-06"), item("e", "2026-10-06"), item("f", "2026-10-09")], "2026-10-04");
    expect(list.upNext.map((i) => i.id)).toEqual(["d", "e"]);
  });
});

describe("groupItemsByWeek", () => {
  it("groups by Monday-start week, skips the past, and sums minutes", () => {
    const weeks = groupItemsByWeek(
      [item("past", "2026-09-30"), item("a", "2026-10-04"), item("b", "2026-10-05", { done: true }), item("c", "2026-10-12")],
      "2026-10-04",
    );
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(weeks[0]!.itemCount).toBe(1); // 2026-10-04 is a Sunday, still in the week of 28 Sep
    expect(weeks[1]).toMatchObject({ minutes: 30, doneCount: 1, itemCount: 1 });
  });
});
