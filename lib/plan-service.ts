// Generates (or regenerates) a student's Phase 3 study plan: loads their
// state, runs the pure scheduler, and replaces the plan's not-yet-completed
// items. Dependency-injected like lib/plan-generator.ts so the whole flow is
// testable against an in-memory fake. Real queries: lib/plan-db.ts. The
// "use server" entry point: lib/planner-actions.ts (generateStudyPlan).
//
// Rules this enforces (context-transfer doc, §4.8 and "Never do"):
//   * completed items are frozen: kept as they are, never rescheduled;
//   * "today" is the student's calendar day, not the server's;
//   * an infeasible plan is reported, never silently squeezed;
//   * switching subject (or leftover Phase 2 rows) replaces the old items.
import { scheduleStudyPlan, type FrozenItem } from "./plan-scheduler";
import {
  loadPlanningState,
  toSchedulerTopics,
  type PlanReadDeps,
} from "./plan-state";
import type { PlanItemKind, PlanReason, PlanSummary } from "./planner-vocab";
import type { Subject } from "./subjects";

export interface NewPlanItem {
  topicId: string;
  scheduledFor: string;
  kind: PlanItemKind;
  reason: PlanReason;
  minutes: number;
  position: number;
}

export interface CompletedItemRow {
  topicId: string;
  kind: PlanItemKind;
  scheduledFor: string;
}

export interface PlanWriteDeps {
  getExistingPlan: (userId: string) => Promise<{ id: string } | null>;
  // Creates the user's plan row or updates the existing one; returns its id.
  upsertPlan: (
    userId: string,
    row: { targetExamDate: string; summary: PlanSummary },
  ) => Promise<string>;
  // Deletes items (completed or not) whose topic belongs to another subject or
  // has no syllabus key — i.e. Phase 2 leftovers and a previous subject's plan.
  deleteOutOfScopeItems: (planId: string, subject: Subject) => Promise<void>;
  getCompletedItems: (planId: string) => Promise<CompletedItemRow[]>;
  deleteOpenItems: (planId: string) => Promise<void>;
  insertItems: (planId: string, items: NewPlanItem[]) => Promise<void>;
}

export interface PlanServiceDeps extends PlanReadDeps, PlanWriteDeps {
  transaction?: <T>(callback: (tx: PlanServiceDeps) => Promise<T>) => Promise<T>;
}

export type GenerateStudyPlanResult =
  | {
      ok: true;
      planId: string;
      feasible: boolean;
      itemCount: number;
      summary: PlanSummary;
    }
  | {
      ok: false;
      reason:
        | "no_settings" // onboarding not done
        | "no_exam_date" // no published dates for the chosen stage and year
        | "exam_passed" // that stage has already finished
        | "no_days" // the exam starts today or sooner: nothing left to plan
        | "topics_not_seeded"; // `pnpm db:seed` has not been run for this subject
    };

export async function generateStudyPlanCore(
  deps: PlanServiceDeps,
  userId: string,
  now: Date,
): Promise<GenerateStudyPlanResult> {
  if (deps.transaction) {
    return deps.transaction((tx) =>
      generateStudyPlanCore({ ...tx, transaction: undefined }, userId, now),
    );
  }

  const state = await loadPlanningState(deps, userId, now);
  if (!state) return { ok: false, reason: "no_settings" };
  const { settings, window, today } = state;
  if (!window) return { ok: false, reason: "no_exam_date" };
  if (window.end < today) return { ok: false, reason: "exam_passed" };
  if (state.topics.length === 0) return { ok: false, reason: "topics_not_seeded" };

  // Clear out other subjects' / Phase 2 items first so they cannot count as
  // completed history for this plan.
  const existing = await deps.getExistingPlan(userId);
  if (existing) await deps.deleteOutOfScopeItems(existing.id, settings.subject);
  const completed = existing ? await deps.getCompletedItems(existing.id) : [];
  const frozen: FrozenItem[] = completed.map((c) => ({
    topicKey: c.topicId,
    kind: c.kind,
    scheduledFor: c.scheduledFor,
  }));

  const result = scheduleStudyPlan({
    topics: toSchedulerTopics(state),
    today,
    examDate: window.start,
    hoursPerWeek: settings.hoursPerWeek,
    masteryTarget: state.masteryTarget,
    frozen,
  });
  if (result.problem === "no_days") return { ok: false, reason: "no_days" };

  const summary: PlanSummary = {
    subject: settings.subject,
    stage: settings.stage,
    examYear: settings.examYear,
    examDate: window.start,
    hoursPerWeek: settings.hoursPerWeek,
    feasible: result.feasible,
    requiredMinutes: result.requiredMinutes,
    availableMinutes: result.availableMinutes,
    shortfallMinutes: result.shortfallMinutes,
    windowDays: result.windowDays,
    bufferDays: result.bufferDays,
    droppedTopicIds: result.droppedTopicKeys,
    calibrationOffset: Math.round(state.calibrationOffset * 1000) / 1000,
    topicsWithoutQuiz: state.topics.filter((t) => !t.canConfirm).length,
  };

  const planId = await deps.upsertPlan(userId, {
    targetExamDate: window.start,
    summary,
  });
  await deps.deleteOpenItems(planId);
  await deps.insertItems(
    planId,
    result.items.map((item) => ({
      topicId: item.topicKey,
      scheduledFor: item.scheduledFor,
      kind: item.kind,
      reason: item.reason,
      minutes: item.minutes,
      position: item.position,
    })),
  );

  return {
    ok: true,
    planId,
    feasible: result.feasible,
    itemCount: result.items.length,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Ticking a session off by hand
// ---------------------------------------------------------------------------

// Reading and revising leave no automatic signal (only quizzes do), so the
// student marks study and review sessions done themselves. Ownership is
// checked against the plan, never against anything the client sends.
export interface PlanItemDoneDeps {
  // The item's completion state if it belongs to `userId`'s plan, else null.
  getOwnedItem: (
    userId: string,
    itemId: string,
  ) => Promise<{ id: string; completedAt: Date | null } | null>;
  setCompletedAt: (itemId: string, completedAt: Date | null) => Promise<void>;
}

export type SetPlanItemDoneResult =
  | { ok: true; done: boolean }
  | { ok: false; reason: "invalid" | "not_found" };

export async function setPlanItemDoneCore(
  deps: PlanItemDoneDeps,
  userId: string,
  itemId: unknown,
  done: unknown,
  now: Date,
): Promise<SetPlanItemDoneResult> {
  if (typeof itemId !== "string" || itemId.length === 0 || itemId.length > 64) {
    return { ok: false, reason: "invalid" };
  }
  if (typeof done !== "boolean") return { ok: false, reason: "invalid" };

  const item = await deps.getOwnedItem(userId, itemId);
  if (!item) return { ok: false, reason: "not_found" };

  // Idempotent: ticking an item that is already done keeps its original time.
  if (done && item.completedAt) return { ok: true, done: true };
  if (!done && !item.completedAt) return { ok: true, done: false };

  await deps.setCompletedAt(item.id, done ? now : null);
  return { ok: true, done };
}
