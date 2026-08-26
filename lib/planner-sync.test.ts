import { describe, expect, it, vi } from "vitest";
import { syncPlanItemCompletionCore, type PlanSyncDeps } from "./planner-sync";
import type { TopicStatus } from "./planner";

function makeFakeDeps(overrides: Partial<PlanSyncDeps> = {}) {
  const planItemStore = { id: "item-1", completedAt: null as Date | null };
  const markComplete = vi.fn(async () => {
    planItemStore.completedAt = new Date("2026-06-01T00:00:00Z");
  });

  const deps: PlanSyncDeps = {
    getStatus: vi.fn(async (): Promise<TopicStatus> => "done"),
    getUserPlanId: vi.fn(async () => "plan-1"),
    getPlanItem: vi.fn(async () => ({ ...planItemStore })),
    markComplete,
    ...overrides,
  };

  return { deps, planItemStore, markComplete };
}

// spec §8 required test: "submitting a passing quiz attempt sets the linked
// plan_items.completed_at; no code path sets it manually." This exercises
// the sync function that lib/quiz-actions.ts calls right after recording a
// passing attempt.
describe("syncPlanItemCompletionCore", () => {
  it("marks the plan item complete when the derived status is done", async () => {
    const { deps, markComplete } = makeFakeDeps();

    await syncPlanItemCompletionCore(deps, "user-1", "topic-1");

    expect(markComplete).toHaveBeenCalledWith("item-1");
  });

  it("does nothing when the derived status is not done", async () => {
    const { deps, markComplete } = makeFakeDeps({
      getStatus: vi.fn(async (): Promise<TopicStatus> => "in_progress"),
    });

    await syncPlanItemCompletionCore(deps, "user-1", "topic-1");

    expect(markComplete).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no plan yet", async () => {
    const { deps, markComplete } = makeFakeDeps({
      getUserPlanId: vi.fn(async () => null),
    });

    await syncPlanItemCompletionCore(deps, "user-1", "topic-1");

    expect(markComplete).not.toHaveBeenCalled();
  });

  it("does not re-stamp completedAt if it is already set (idempotent)", async () => {
    const { deps, markComplete } = makeFakeDeps({
      getPlanItem: vi.fn(async () => ({
        id: "item-1",
        completedAt: new Date("2026-01-01T00:00:00Z"),
      })),
    });

    await syncPlanItemCompletionCore(deps, "user-1", "topic-1");

    expect(markComplete).not.toHaveBeenCalled();
  });

  it("does nothing when the topic has no linked plan item", async () => {
    const { deps, markComplete } = makeFakeDeps({
      getPlanItem: vi.fn(async () => null),
    });

    await syncPlanItemCompletionCore(deps, "user-1", "topic-1");

    expect(markComplete).not.toHaveBeenCalled();
  });
});
