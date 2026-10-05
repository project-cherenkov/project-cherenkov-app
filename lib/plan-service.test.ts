import { describe, expect, it } from "vitest";
import {
  generateStudyPlanCore,
  setPlanItemDoneCore,
  type CompletedItemRow,
  type NewPlanItem,
  type PlanServiceDeps,
} from "./plan-service";
import type { PlannerSettings } from "./planner-settings";
import type { PlanSummary } from "./planner-vocab";
import { getAllSyllabi } from "./syllabus";

const NOW = new Date("2026-10-04T05:00:00Z");

function makeFake(opts: {
  settings?: PlannerSettings | null;
  completed?: CompletedItemRow[];
  existingPlan?: boolean;
  withQuestions?: boolean;
  answers?: { topicId: string; correct: boolean; answeredAt: Date }[];
  ratings?: Record<string, number>;
} = {}) {
  const physics = getAllSyllabi().find((s) => s.subject === "physics")!;
  const syllabusTopics = physics.sections.filter((s) => s.part === "theory").flatMap((s) =>
    s.topics.map((t) => ({ sectionId: s.id, id: t.id })),
  );
  const rows = syllabusTopics.map((t, i) => ({
    id: `uuid-${i}`,
    syllabusTopicId: t.id,
    sectionId: t.sectionId,
    order: i,
  }));
  const log = { inserted: [] as NewPlanItem[], deletedOpen: 0, outOfScope: 0, summary: null as PlanSummary | null, targetExamDate: "" };
  const settings: PlannerSettings | null =
    opts.settings === undefined
      ? { subject: "physics", stage: "osn_k", examYear: 2027, hoursPerWeek: 7, timezone: "Asia/Jakarta" }
      : opts.settings;

  const deps: PlanServiceDeps = {
    getSettings: async () => settings,
    getSubjectTopics: async () => rows,
    getSelfRatings: async () => new Map(Object.entries(opts.ratings ?? {})),
    getAnswers: async () => opts.answers ?? [],
    getTopicsWithQuestions: async () => new Set(opts.withQuestions === false ? [] : rows.map((r) => r.id)),
    getExistingPlan: async () => (opts.existingPlan ? { id: "plan-1" } : null),
    upsertPlan: async (_u, row) => {
      log.summary = row.summary;
      log.targetExamDate = row.targetExamDate;
      return "plan-1";
    },
    deleteOutOfScopeItems: async () => {
      log.outOfScope++;
    },
    getCompletedItems: async () => opts.completed ?? [],
    deleteOpenItems: async () => {
      log.deletedOpen++;
    },
    insertItems: async (_p, items) => {
      log.inserted.push(...items);
    },
  };
  return { deps, log, rows };
}

describe("generateStudyPlanCore", () => {
  it("fails with no_settings before onboarding", async () => {
    const { deps } = makeFake({ settings: null });
    expect(await generateStudyPlanCore(deps, "u", NOW)).toEqual({ ok: false, reason: "no_settings" });
  });

  it("builds a plan from the saved settings and stores a summary", async () => {
    const { deps, log, rows } = makeFake({ ratings: { "uuid-0": 5, "uuid-1": 1 } });
    const result = await generateStudyPlanCore(deps, "u", NOW);
    expect(result.ok).toBe(true);
    expect(log.targetExamDate).toBe("2027-06-18");
    expect(log.summary?.hoursPerWeek).toBe(7);
    expect(log.inserted.length).toBeGreaterThan(0);
    expect(log.inserted.every((i) => rows.some((r) => r.id === i.topicId))).toBe(true);
    // Student's calendar day: 05:00 UTC on 4 Oct is already 12:00 on 4 Oct in Jakarta.
    expect(log.inserted.map((i) => i.scheduledFor).sort()[0]! >= "2026-10-04").toBe(true);
  });

  it("uses the student's day, not the server's, when they differ", async () => {
    const lateUtc = new Date("2026-10-04T20:00:00Z"); // already 5 Oct in Jakarta
    const { deps, log } = makeFake();
    await generateStudyPlanCore(deps, "u", lateUtc);
    expect(log.inserted.map((i) => i.scheduledFor).sort()[0]).toBe("2026-10-05");
  });

  it("is deterministic", async () => {
    const a = makeFake({ ratings: { "uuid-2": 4 } });
    const b = makeFake({ ratings: { "uuid-2": 4 } });
    await generateStudyPlanCore(a.deps, "u", NOW);
    await generateStudyPlanCore(b.deps, "u", NOW);
    expect(b.log.inserted).toEqual(a.log.inserted);
  });

  it("keeps completed items: no second study session for a finished topic, and clears only open items", async () => {
    const { deps, log } = makeFake({
      existingPlan: true,
      ratings: { "uuid-0": 1 },
      withQuestions: false,
      completed: [{ topicId: "uuid-0", kind: "study", scheduledFor: "2026-10-01" }],
    });
    await generateStudyPlanCore(deps, "u", NOW);
    expect(log.deletedOpen).toBe(1);
    expect(log.outOfScope).toBe(1);
    expect(log.inserted.some((i) => i.topicId === "uuid-0" && i.kind === "study")).toBe(false);
  });

  it("reports an infeasible plan instead of hiding it", async () => {
    const { deps, log } = makeFake({
      settings: { subject: "physics", stage: "osn_k", examYear: 2027, hoursPerWeek: 0.5, timezone: "Asia/Jakarta" },
      withQuestions: false,
    });
    // Exam is far away; shrink the window by moving "now" close to it.
    const result = await generateStudyPlanCore(deps, "u", new Date("2027-06-05T00:00:00Z"));
    expect(result.ok && result.feasible).toBe(false);
    expect(log.summary?.shortfallMinutes).toBeGreaterThan(0);
    expect(log.summary?.droppedTopicIds.length).toBeGreaterThan(0);
  });

  it("refuses to plan when the exam has started or passed", async () => {
    const { deps } = makeFake();
    expect(await generateStudyPlanCore(deps, "u", new Date("2027-06-18T00:00:00Z"))).toEqual({ ok: false, reason: "no_days" });
    expect(await generateStudyPlanCore(deps, "u", new Date("2027-07-01T00:00:00Z"))).toEqual({ ok: false, reason: "exam_passed" });
  });

  it("only counts quiz answers at the stage's difficulty (the dependency receives the range)", async () => {
    let seen: string[] = [];
    const { deps } = makeFake();
    const original = deps.getAnswers;
    deps.getAnswers = async (u, ids, difficulties) => {
      seen = difficulties;
      return original(u, ids, difficulties);
    };
    await generateStudyPlanCore(deps, "u", NOW);
    expect(seen).toEqual(["basic", "intermediate"]);
  });
});

describe("setPlanItemDoneCore", () => {
  function fakeItem(completedAt: Date | null) {
    let current = completedAt;
    const writes: (Date | null)[] = [];
    return {
      writes,
      deps: {
        getOwnedItem: async (userId: string, itemId: string) =>
          userId === "owner" && itemId === "item-1" ? { id: "item-1", completedAt: current } : null,
        setCompletedAt: async (_id: string, value: Date | null) => {
          current = value;
          writes.push(value);
        },
      },
    };
  }

  it("marks an item done and back again", async () => {
    const f = fakeItem(null);
    expect(await setPlanItemDoneCore(f.deps, "owner", "item-1", true, NOW)).toEqual({ ok: true, done: true });
    expect(await setPlanItemDoneCore(f.deps, "owner", "item-1", false, NOW)).toEqual({ ok: true, done: false });
    expect(f.writes).toEqual([NOW, null]);
  });

  it("is idempotent and keeps the first completion time", async () => {
    const f = fakeItem(new Date("2026-01-01T00:00:00Z"));
    await setPlanItemDoneCore(f.deps, "owner", "item-1", true, NOW);
    expect(f.writes).toEqual([]);
  });

  it("cannot touch another user's item", async () => {
    const f = fakeItem(null);
    expect(await setPlanItemDoneCore(f.deps, "intruder", "item-1", true, NOW)).toEqual({ ok: false, reason: "not_found" });
    expect(f.writes).toEqual([]);
  });

  it.each([[undefined, true], ["", true], [42, true], ["item-1", "yes"], ["item-1", undefined]])(
    "rejects malformed input (%s, %s)",
    async (id, done) => {
      const f = fakeItem(null);
      expect(await setPlanItemDoneCore(f.deps, "owner", id, done, NOW)).toEqual({ ok: false, reason: "invalid" });
    },
  );
});
