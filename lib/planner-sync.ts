import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { studyPlans, planItems } from "@/lib/db/schema";
import { getTopicStatus, type TopicStatus } from "@/lib/planner";

// Called directly from lib/quiz-actions.ts right after a quiz attempt is
// recorded — deliberately a plain function, NOT exported from a "use
// server" file. Every export from a "use server" module becomes a publicly
// callable RPC endpoint, and this function's (userId, topicId) signature
// would let any caller stamp an arbitrary user's plan item complete if it
// were reachable that way. Only server-side code that already trusts its
// own userId (never one taken from a request body) may call this.

export interface PlanItemRef {
  id: string;
  completedAt: Date | null;
}

export interface PlanSyncDeps {
  getStatus: (userId: string, topicId: string) => Promise<TopicStatus>;
  getUserPlanId: (userId: string) => Promise<string | null>;
  getPlanItem: (
    planId: string,
    topicId: string,
  ) => Promise<PlanItemRef | null>;
  markComplete: (planItemId: string) => Promise<void>;
}

// DI'd core, testable without a database (spec §8's completed_at test).
//
// Decision #8: completed_at is set automatically, never a manual field.
// Sticky/monotonic (documented assumption, not explicitly specified): once
// set, a later retake that drops status back to in_progress (spec §6
// boundary case) does not clear completedAt — the spec documents the
// status reversal but says nothing about un-completing a plan item, so this
// keeps "completed at least once" as the recorded fact, the more
// conservative reading.
export async function syncPlanItemCompletionCore(
  deps: PlanSyncDeps,
  userId: string,
  topicId: string,
): Promise<void> {
  const status = await deps.getStatus(userId, topicId);
  if (status !== "done") return;

  const planId = await deps.getUserPlanId(userId);
  if (!planId) return; // no plan yet — nothing to stamp

  const item = await deps.getPlanItem(planId, topicId);
  if (!item || item.completedAt) return;

  await deps.markComplete(item.id);
}

const realDeps: PlanSyncDeps = {
  getStatus: getTopicStatus,
  async getUserPlanId(userId) {
    const [plan] = await db
      .select({ id: studyPlans.id })
      .from(studyPlans)
      .where(eq(studyPlans.userId, userId))
      .limit(1);
    return plan?.id ?? null;
  },
  async getPlanItem(planId, topicId) {
    const [item] = await db
      .select({ id: planItems.id, completedAt: planItems.completedAt })
      .from(planItems)
      .where(and(eq(planItems.planId, planId), eq(planItems.topicId, topicId)))
      .limit(1);
    return item ?? null;
  },
  async markComplete(planItemId) {
    await db
      .update(planItems)
      .set({ completedAt: new Date() })
      .where(eq(planItems.id, planItemId));
  },
};

export async function syncPlanItemCompletion(
  userId: string,
  topicId: string,
): Promise<void> {
  return syncPlanItemCompletionCore(realDeps, userId, topicId);
}
