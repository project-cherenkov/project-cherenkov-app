"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { studyPlans, planItems, topics } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth-guard";
import {
  generateOrRegeneratePlanCore,
  type PlanGenerationDeps,
} from "@/lib/plan-generator";

export type GeneratePlanResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "no_topics" };

const realDeps: PlanGenerationDeps = {
  async getAllTopics() {
    return db.select({ id: topics.id, order: topics.order }).from(topics);
  },
  async getExistingPlan(userId) {
    const [row] = await db
      .select({ id: studyPlans.id })
      .from(studyPlans)
      .where(eq(studyPlans.userId, userId))
      .limit(1);
    return row ?? null;
  },
  async insertPlan(userId, targetExamDate) {
    const [row] = await db
      .insert(studyPlans)
      .values({ userId, targetExamDate })
      .returning({ id: studyPlans.id });
    return row!.id;
  },
  async updatePlan(planId, targetExamDate) {
    await db
      .update(studyPlans)
      .set({ targetExamDate, generatedAt: new Date() })
      .where(eq(studyPlans.id, planId));
  },
  async deletePlanItems(planId) {
    await db.delete(planItems).where(eq(planItems.planId, planId));
  },
  async insertPlanItems(planId, items) {
    if (items.length === 0) return;
    await db.insert(planItems).values(
      items.map((item) => ({
        planId,
        topicId: item.topicId,
        scheduledFor: item.scheduledFor,
      })),
    );
  },
};

// PLANNER-002. Handles both "Generate plan" and "Regenerate plan" (spec
// §5's UI decision) with a single action — decision #7 means they're the
// same operation: update-or-create the user's one study_plans row, then
// replace its plan_items wholesale (generateOrRegeneratePlanCore in
// lib/plan-generator.ts owns that decision).
//
// Defense-in-depth (spec §9 HIGH risk mitigation): derives the user from
// the session server-side via getCurrentUser() — never accepts a userId
// from the caller — even though middleware.ts's planner-auth branch already
// blocks unauthenticated requests to /planner/** before a Server Action
// like this could even be invoked from that surface.
export async function generatePlan(
  targetExamDate: string,
): Promise<GeneratePlanResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const today = new Date().toISOString().slice(0, 10);
  const result = await generateOrRegeneratePlanCore(
    realDeps,
    user.id,
    targetExamDate,
    today,
  );

  if (!result.ok) return result;
  return { ok: true };
}
