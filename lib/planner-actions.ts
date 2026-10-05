"use server";

import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  studyPlans,
  planItems,
  topics,
  userPlannerSettings,
} from "@/lib/db/schema";
import { DEFAULT_PLANNER_TIMEZONE } from "@/lib/planner-vocab";
import { isValidTimeZone, todayInTimeZone } from "@/lib/osn-stages";
import { getCurrentUser } from "@/lib/auth-guard";
import {
  generateOrRegeneratePlanCore,
  type PlanGenerationDeps,
  type PlanGenerationTxDeps,
} from "@/lib/plan-generator";
import {
  generateStudyPlanCore,
  setPlanItemDoneCore,
  type GenerateStudyPlanResult,
  type SetPlanItemDoneResult,
} from "@/lib/plan-service";
import { planItemDoneDeps, planServiceDeps } from "@/lib/plan-db";

export type GeneratePlanResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "no_topics" | "invalid_date" };

// ROBUST-002 / TICKET-05: matches the "YYYY-MM-DD" shape the <input
// type="date"> client always sends, then confirms it's a real calendar
// date (rejects e.g. "2026-02-30", which the regex alone would accept).
// Server Actions are network-callable directly, not just reachable through
// the form that happens to invoke them in the browser, so the date input's
// client-side format guarantee doesn't extend to a direct call with an
// arbitrary payload — see lib/plan-generator.ts's addDays/daysBetween,
// which would otherwise throw `RangeError: Invalid time value` on
// toISOString() for a malformed string.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalDate(value: string): Date {
  const parts = value.split("-");
  if (parts.length !== 3) {
    return new Date(NaN);
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(year, month - 1, day);
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = parseLocalDate(value);
  if (Number.isNaN(d.getTime())) return false;
  const normalized = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
  return normalized === value;
}

const realDeps: PlanGenerationDeps = {
  async getAllTopics() {
    return db
      .select({ id: topics.id, subject: topics.subject, order: topics.order })
      .from(topics)
      .orderBy(asc(topics.subject), asc(topics.order), asc(topics.id));
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
  async getCompletedTopicIds(planId) {
    const rows = await db
      .select({ topicId: planItems.topicId })
      .from(planItems)
      .where(and(eq(planItems.planId, planId), isNotNull(planItems.completedAt)));
    return rows.map((r) => r.topicId);
  },
  async deleteUncompletedPlanItems(planId) {
    await db
      .delete(planItems)
      .where(and(eq(planItems.planId, planId), isNull(planItems.completedAt)));
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
  async transaction(callback) {
    return db.transaction(async (tx) => {
      const txDeps: PlanGenerationTxDeps = {
        async getAllTopics() {
          return tx
            .select({ id: topics.id, subject: topics.subject, order: topics.order })
            .from(topics)
            .orderBy(asc(topics.subject), asc(topics.order), asc(topics.id));
        },
        async getExistingPlan(userId) {
          const [row] = await tx
            .select({ id: studyPlans.id })
            .from(studyPlans)
            .where(eq(studyPlans.userId, userId))
            .limit(1);
          return row ?? null;
        },
        async insertPlan(userId, targetExamDate) {
          const [row] = await tx
            .insert(studyPlans)
            .values({ userId, targetExamDate })
            .returning({ id: studyPlans.id });
          return row!.id;
        },
        async updatePlan(planId, targetExamDate) {
          await tx
            .update(studyPlans)
            .set({ targetExamDate, generatedAt: new Date() })
            .where(eq(studyPlans.id, planId));
        },
        async getCompletedTopicIds(planId) {
          const rows = await tx
            .select({ topicId: planItems.topicId })
            .from(planItems)
            .where(
              and(eq(planItems.planId, planId), isNotNull(planItems.completedAt)),
            );
          return rows.map((r) => r.topicId);
        },
        async deleteUncompletedPlanItems(planId) {
          await tx
            .delete(planItems)
            .where(
              and(eq(planItems.planId, planId), isNull(planItems.completedAt)),
            );
        },
        async insertPlanItems(planId, items) {
          if (items.length === 0) return;
          await tx.insert(planItems).values(
            items.map((item) => ({
              planId,
              topicId: item.topicId,
              scheduledFor: item.scheduledFor,
            })),
          );
        },
      };

      return callback(txDeps);
    });
  },
};

// PHASE 2 FALLBACK. The /planner page no longer calls this: it uses
// generateStudyPlan() below. It is kept (with lib/plan-generator.ts's
// even-spread generator) as the deterministic fallback the Phase 3 docs ask
// for, and because its tests pin that behaviour.
//
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
  if (!isValidIsoDate(targetExamDate)) {
    return { ok: false, reason: "invalid_date" };
  }

  // "Today" is the student's calendar day, not the server's. Vercel runs in
  // UTC, which is still "yesterday" in Indonesia (UTC+7) for ~7 hours a day.
  // The first check runs before authentication, so it can only use the
  // default zone; it is a cheap sanity check, and is repeated below with the
  // student's own zone once that is known.
  if (targetExamDate < todayInTimeZone(new Date(), DEFAULT_PLANNER_TIMEZONE)) {
    return { ok: false, reason: "invalid_date" };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const [settings] = await db
    .select({ timezone: userPlannerSettings.timezone })
    .from(userPlannerSettings)
    .where(eq(userPlannerSettings.userId, user.id))
    .limit(1);
  const timeZone =
    settings && isValidTimeZone(settings.timezone)
      ? settings.timezone
      : DEFAULT_PLANNER_TIMEZONE;
  const today = todayInTimeZone(new Date(), timeZone);
  if (targetExamDate < today) {
    return { ok: false, reason: "invalid_date" };
  }

  const result = await generateOrRegeneratePlanCore(
    realDeps,
    user.id,
    targetExamDate,
    today,
  );

  if (!result.ok) return result;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 3 actions
// ---------------------------------------------------------------------------

export type GenerateStudyPlanActionResult =
  | GenerateStudyPlanResult
  | { ok: false; reason: "unauthenticated" };

// Builds (or rebuilds) the signed-in student's adaptive plan from their saved
// settings, self-ratings and quiz answers (lib/plan-service.ts). This is what
// the /planner page calls. The user always comes from the session.
export async function generateStudyPlan(): Promise<GenerateStudyPlanActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  return generateStudyPlanCore(planServiceDeps, user.id, new Date());
}

export type SetPlanItemDoneActionResult =
  | SetPlanItemDoneResult
  | { ok: false; reason: "unauthenticated" };

// Ticks a study/review session off (or back on). `itemId` and `done` are
// untrusted client input; ownership is checked server-side.
export async function setPlanItemDone(
  itemId: unknown,
  done: unknown,
): Promise<SetPlanItemDoneActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  return setPlanItemDoneCore(planItemDoneDeps, user.id, itemId, done, new Date());
}
