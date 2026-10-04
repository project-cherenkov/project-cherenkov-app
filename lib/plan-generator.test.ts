import { describe, expect, it } from "vitest";
import {
  generatePlanItems,
  generateOrRegeneratePlanCore,
  type PlanGenerationDeps,
  type PlanTopic,
  type GeneratedPlanItem,
} from "./plan-generator";

const FIVE_TOPICS: PlanTopic[] = [
  { id: "t1", subject: "informatics", order: 0 },
  { id: "t2", subject: "informatics", order: 1 },
  { id: "t3", subject: "informatics", order: 2 },
  { id: "t4", subject: "informatics", order: 3 },
  { id: "t5", subject: "informatics", order: 4 },
];

// spec §8 required test: "Plan generation is deterministic and even —
// fixed topic list + fixed exam date -> assert the same plan_items output
// on repeated runs; assert every topic appears exactly once."
describe("generatePlanItems — determinism and even distribution", () => {
  it("produces identical output on repeated runs with the same inputs", () => {
    const first = generatePlanItems(FIVE_TOPICS, "2026-06-05", "2026-06-01");
    const second = generatePlanItems(FIVE_TOPICS, "2026-06-05", "2026-06-01");
    expect(second).toEqual(first);
  });

  it("schedules every topic exactly once", () => {
    const items = generatePlanItems(FIVE_TOPICS, "2026-06-05", "2026-06-01");
    expect(items).toHaveLength(FIVE_TOPICS.length);
    const topicIds = items.map((i) => i.topicId).sort();
    expect(topicIds).toEqual(FIVE_TOPICS.map((t) => t.id).sort());
  });

  it("sorts by subject before order when topic order restarts per subject", () => {
    const mixed: PlanTopic[] = [
      { id: "physics-2", subject: "physics", order: 1 },
      { id: "informatics-1", subject: "informatics", order: 0 },
      { id: "physics-1", subject: "physics", order: 0 },
      { id: "astronomy-1", subject: "astronomy", order: 0 },
      { id: "informatics-2", subject: "informatics", order: 1 },
    ];

    const items = generatePlanItems(mixed, "2026-06-05", "2026-06-01");
    expect(items.map((item) => item.topicId)).toEqual([
      "informatics-1",
      "informatics-2",
      "physics-1",
      "physics-2",
      "astronomy-1",
    ]);
  });

  it("spreads topics evenly across a window at least as long as the topic count", () => {
    // 5 topics, 5-day window (inclusive of exam day) -> one topic per day.
    const items = generatePlanItems(FIVE_TOPICS, "2026-06-05", "2026-06-01");
    const dates = items.map((i) => i.scheduledFor).sort();
    expect(dates).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
  });
});

// spec §8 required test: "Compressed plan on a short window — exam date
// closer than topic count -> plan still contains every topic, no thrown
// error."
describe("generatePlanItems — compressed-window boundary case", () => {
  it("compresses every topic onto today when the exam date is today", () => {
    const items = generatePlanItems(FIVE_TOPICS, "2026-06-01", "2026-06-01");
    expect(items).toHaveLength(5);
    expect(items.every((i) => i.scheduledFor === "2026-06-01")).toBe(true);
  });

  it("does not throw when the exam date is in the past", () => {
    expect(() =>
      generatePlanItems(FIVE_TOPICS, "2020-01-01", "2026-06-01"),
    ).not.toThrow();
    const items = generatePlanItems(FIVE_TOPICS, "2020-01-01", "2026-06-01");
    expect(items).toHaveLength(5);
  });

  it("compresses multiple topics per day when the window is shorter than the topic count", () => {
    // 5 topics, 2-day window.
    const items = generatePlanItems(FIVE_TOPICS, "2026-06-02", "2026-06-01");
    const uniqueDays = new Set(items.map((i) => i.scheduledFor));
    expect(items).toHaveLength(5);
    expect(uniqueDays.size).toBeLessThanOrEqual(2);
  });

  it("returns an empty plan for zero topics without throwing", () => {
    expect(generatePlanItems([], "2026-06-05", "2026-06-01")).toEqual([]);
  });
});

// In-memory fake standing in for the database, so the regeneration test
// doesn't need a live Postgres connection.
function makeFakePlanStore() {
  let nextId = 1;
  const plans = new Map<string, { id: string; targetExamDate: string }>(); // keyed by userId
  const items = new Map<string, GeneratedPlanItem[]>(); // keyed by planId
  const completedTopicIds = new Set<string>(); // topics whose item is completed

  const deps: PlanGenerationDeps = {
    async getAllTopics() {
      return FIVE_TOPICS;
    },
    async getExistingPlan(userId) {
      const plan = plans.get(userId);
      return plan ? { id: plan.id } : null;
    },
    async insertPlan(userId, targetExamDate) {
      const id = `plan-${nextId++}`;
      plans.set(userId, { id, targetExamDate });
      return id;
    },
    async updatePlan(planId, targetExamDate) {
      for (const [userId, plan] of plans) {
        if (plan.id === planId) plans.set(userId, { id: planId, targetExamDate });
      }
    },
    async getCompletedTopicIds(planId) {
      return (items.get(planId) ?? [])
        .filter((item) => completedTopicIds.has(item.topicId))
        .map((item) => item.topicId);
    },
    async deleteUncompletedPlanItems(planId) {
      items.set(
        planId,
        (items.get(planId) ?? []).filter((item) => completedTopicIds.has(item.topicId)),
      );
    },
    async insertPlanItems(planId, newItems) {
      items.set(planId, [...(items.get(planId) ?? []), ...newItems]);
    },
  };

  return { deps, plans, items, completedTopicIds };
}

// spec §8 required test: "Regeneration overwrites, doesn't duplicate —
// generate, then regenerate with a different exam date -> exactly one
// study_plans row and a fresh plan_items set for that user."
describe("generateOrRegeneratePlanCore — regeneration semantics", () => {
  it("creates exactly one plan on first generation", async () => {
    const { deps, plans } = makeFakePlanStore();
    await generateOrRegeneratePlanCore(deps, "user-1", "2026-06-05", "2026-06-01");
    expect(plans.size).toBe(1);
  });

  it("regenerating with a different exam date updates the same plan, not a second one", async () => {
    const { deps, plans, items } = makeFakePlanStore();

    const first = await generateOrRegeneratePlanCore(
      deps,
      "user-1",
      "2026-06-05",
      "2026-06-01",
    );
    expect(first.ok).toBe(true);

    const second = await generateOrRegeneratePlanCore(
      deps,
      "user-1",
      "2026-12-25", // different exam date
      "2026-06-01",
    );
    expect(second.ok).toBe(true);

    // Exactly one study_plans row for this user, still.
    expect(plans.size).toBe(1);
    if (first.ok && second.ok) {
      expect(second.planId).toBe(first.planId);
    }

    // plan_items reflect the new exam date's schedule, not a merge of both.
    const finalItems = items.get(plans.get("user-1")!.id)!;
    expect(finalItems).toHaveLength(FIVE_TOPICS.length);
    expect(plans.get("user-1")?.targetExamDate).toBe("2026-12-25");
  });

  it("returns no_topics without touching the store when there are no topics", async () => {
    const { deps, plans } = makeFakePlanStore();
    deps.getAllTopics = async () => [];

    const result = await generateOrRegeneratePlanCore(
      deps,
      "user-1",
      "2026-06-05",
      "2026-06-01",
    );

    expect(result).toEqual({ ok: false, reason: "no_topics" });
    expect(plans.size).toBe(0);
  });
});

// Phase 3: regeneration must not undo history.
describe("generateOrRegeneratePlanCore — completed items survive regeneration", () => {
  async function generateThenComplete(completeIds: string[]) {
    const store = makeFakePlanStore();
    await generateOrRegeneratePlanCore(store.deps, "user-1", "2026-06-05", "2026-06-01");
    for (const id of completeIds) store.completedTopicIds.add(id);
    return store;
  }

  it("keeps completed items untouched and does not schedule their topics again", async () => {
    const { deps, plans, items } = await generateThenComplete(["t1", "t2"]);
    const planId = plans.get("user-1")!.id;
    const originalCompleted = items
      .get(planId)!
      .filter((i) => i.topicId === "t1" || i.topicId === "t2");

    const result = await generateOrRegeneratePlanCore(deps, "user-1", "2026-06-20", "2026-06-10");
    expect(result).toEqual({ ok: true, planId, itemCount: 3 });

    const finalItems = items.get(planId)!;
    // Each topic is on the plan exactly once.
    expect(finalItems.map((i) => i.topicId).sort()).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    // The completed ones kept their original dates.
    for (const original of originalCompleted) {
      expect(finalItems).toContainEqual(original);
    }
    // Only the not-yet-completed topics were rescheduled, from the new "today".
    const rescheduled = finalItems.filter((i) => !["t1", "t2"].includes(i.topicId));
    expect(rescheduled.every((i) => i.scheduledFor >= "2026-06-10")).toBe(true);
  });

  it("schedules nothing new when every topic is already completed", async () => {
    const { deps, plans, items } = await generateThenComplete(["t1", "t2", "t3", "t4", "t5"]);
    const planId = plans.get("user-1")!.id;
    const before = [...items.get(planId)!];

    const result = await generateOrRegeneratePlanCore(deps, "user-1", "2026-06-20", "2026-06-10");

    expect(result).toEqual({ ok: true, planId, itemCount: 0 });
    expect(items.get(planId)).toEqual(before);
  });

  it("still reschedules everything on a plan with no completed items", async () => {
    const { deps, plans, items } = await generateThenComplete([]);
    const planId = plans.get("user-1")!.id;

    await generateOrRegeneratePlanCore(deps, "user-1", "2026-06-20", "2026-06-10");

    expect(items.get(planId)).toHaveLength(5);
    expect(items.get(planId)!.every((i) => i.scheduledFor >= "2026-06-10")).toBe(true);
  });
});
