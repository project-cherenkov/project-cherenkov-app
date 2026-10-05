// Real Drizzle implementations of the dependencies the planner cores take
// (lib/plan-state.ts, lib/plan-service.ts, lib/plan-view.ts). Server-only.
// Deliberately NOT a "use server" module: nothing here may be callable from
// the browser, since every function takes a userId.
import { and, eq, inArray, isNotNull, isNull, max, ne, or } from "drizzle-orm";
import { db, type Database } from "@/lib/db";
import {
  planItems,
  quizAttempts,
  quizQuestionResponses,
  quizQuestions,
  studyPlans,
  topicSelfRatings,
  topics,
  userPlannerSettings,
} from "@/lib/db/schema";
import type { PlannerSettings } from "@/lib/planner-settings";
import type { PlanItemDoneDeps, PlanServiceDeps } from "@/lib/plan-service";
import type { PlanViewDeps } from "@/lib/plan-view";
import type { PlanReadDeps } from "@/lib/plan-state";

// `db` and a transaction handle expose the same query builders.
type Executor = Pick<Database, "select" | "selectDistinct" | "insert" | "update" | "delete">;

const INSERT_CHUNK = 500;

export function makePlanReadDeps(exec: Executor): PlanReadDeps {
  return {
    async getSettings(userId): Promise<PlannerSettings | null> {
      const [row] = await exec
        .select()
        .from(userPlannerSettings)
        .where(eq(userPlannerSettings.userId, userId))
        .limit(1);
      if (!row) return null;
      return {
        subject: row.subject,
        stage: row.stage,
        examYear: row.examYear,
        hoursPerWeek: row.hoursPerWeek,
        timezone: row.timezone,
      };
    },

    async getSubjectTopics(subject) {
      const rows = await exec
        .select({
          id: topics.id,
          syllabusTopicId: topics.syllabusTopicId,
          sectionId: topics.sectionId,
          order: topics.order,
        })
        .from(topics)
        .where(and(eq(topics.subject, subject), isNotNull(topics.syllabusTopicId)));
      return rows.flatMap((r) =>
        r.syllabusTopicId
          ? [{ id: r.id, syllabusTopicId: r.syllabusTopicId, sectionId: r.sectionId, order: r.order }]
          : [],
      );
    },

    async getSelfRatings(userId, topicIds) {
      const map = new Map<string, number>();
      if (topicIds.length === 0) return map;
      const rows = await exec
        .select({ topicId: topicSelfRatings.topicId, rating: topicSelfRatings.rating })
        .from(topicSelfRatings)
        .where(
          and(eq(topicSelfRatings.userId, userId), inArray(topicSelfRatings.topicId, topicIds)),
        );
      for (const r of rows) map.set(r.topicId, r.rating);
      return map;
    },

    async getAnswers(userId, topicIds, difficulties) {
      if (topicIds.length === 0 || difficulties.length === 0) return [];
      return exec
        .select({
          topicId: quizQuestions.topicId,
          correct: quizQuestionResponses.correct,
          answeredAt: quizQuestionResponses.answeredAt,
        })
        .from(quizQuestionResponses)
        .innerJoin(quizAttempts, eq(quizQuestionResponses.attemptId, quizAttempts.id))
        .innerJoin(quizQuestions, eq(quizQuestionResponses.questionId, quizQuestions.id))
        .where(
          and(
            eq(quizAttempts.userId, userId),
            inArray(quizQuestions.topicId, topicIds),
            inArray(quizQuestions.difficulty, difficulties),
          ),
        );
    },

    async getTopicsWithQuestions(topicIds, difficulties) {
      if (topicIds.length === 0 || difficulties.length === 0) return new Set();
      const rows = await exec
        .selectDistinct({ topicId: quizQuestions.topicId })
        .from(quizQuestions)
        .where(
          and(
            inArray(quizQuestions.topicId, topicIds),
            inArray(quizQuestions.difficulty, difficulties),
          ),
        );
      return new Set(rows.map((r) => r.topicId));
    },
  };
}

function makePlanServiceDeps(exec: Executor): PlanServiceDeps {
  return {
    ...makePlanReadDeps(exec),

    async getExistingPlan(userId) {
      const [row] = await exec
        .select({ id: studyPlans.id })
        .from(studyPlans)
        .where(eq(studyPlans.userId, userId))
        .limit(1);
      return row ?? null;
    },

    async upsertPlan(userId, row) {
      const [saved] = await exec
        .insert(studyPlans)
        .values({ userId, targetExamDate: row.targetExamDate, summary: row.summary })
        .onConflictDoUpdate({
          target: studyPlans.userId,
          set: {
            targetExamDate: row.targetExamDate,
            summary: row.summary,
            generatedAt: new Date(),
          },
        })
        .returning({ id: studyPlans.id });
      return saved!.id;
    },

    async deleteOutOfScopeItems(planId, subject) {
      const outOfScope = exec
        .select({ id: topics.id })
        .from(topics)
        .where(or(ne(topics.subject, subject), isNull(topics.syllabusTopicId)));
      await exec
        .delete(planItems)
        .where(and(eq(planItems.planId, planId), inArray(planItems.topicId, outOfScope)));
    },

    async getCompletedItems(planId) {
      return exec
        .select({
          topicId: planItems.topicId,
          kind: planItems.kind,
          scheduledFor: planItems.scheduledFor,
        })
        .from(planItems)
        .where(and(eq(planItems.planId, planId), isNotNull(planItems.completedAt)));
    },

    async deleteOpenItems(planId) {
      await exec
        .delete(planItems)
        .where(and(eq(planItems.planId, planId), isNull(planItems.completedAt)));
    },

    async insertItems(planId, items) {
      for (let i = 0; i < items.length; i += INSERT_CHUNK) {
        await exec
          .insert(planItems)
          .values(items.slice(i, i + INSERT_CHUNK).map((item) => ({ planId, ...item })));
      }
    },
  };
}

export const planServiceDeps: PlanServiceDeps = {
  ...makePlanServiceDeps(db),
  async transaction(callback) {
    return db.transaction(async (tx) => callback(makePlanServiceDeps(tx)));
  },
};

export const planViewDeps: PlanViewDeps = {
  ...makePlanReadDeps(db),

  async getPlan(userId) {
    const [row] = await db
      .select({
        id: studyPlans.id,
        generatedAt: studyPlans.generatedAt,
        targetExamDate: studyPlans.targetExamDate,
        summary: studyPlans.summary,
      })
      .from(studyPlans)
      .where(eq(studyPlans.userId, userId))
      .limit(1);
    return row ?? null;
  },

  async getPlanItems(planId, topicIds) {
    if (topicIds.length === 0) return [];
    return db
      .select({
        id: planItems.id,
        topicId: planItems.topicId,
        scheduledFor: planItems.scheduledFor,
        kind: planItems.kind,
        reason: planItems.reason,
        minutes: planItems.minutes,
        position: planItems.position,
        completedAt: planItems.completedAt,
      })
      .from(planItems)
      .where(and(eq(planItems.planId, planId), inArray(planItems.topicId, topicIds)))
      .orderBy(planItems.scheduledFor, planItems.position);
  },

  async getLatestAttemptAt(userId, topicIds) {
    if (topicIds.length === 0) return null;
    const [row] = await db
      .select({ latest: max(quizAttempts.attemptedAt) })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.userId, userId), inArray(quizAttempts.topicId, topicIds)));
    return row?.latest ?? null;
  },
};

export const planItemDoneDeps: PlanItemDoneDeps = {
  async getOwnedItem(userId, itemId) {
    // A malformed id would make Postgres reject the uuid cast; treat it as
    // "not found" instead of surfacing a database error.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId)) {
      return null;
    }
    const [row] = await db
      .select({ id: planItems.id, completedAt: planItems.completedAt })
      .from(planItems)
      .innerJoin(studyPlans, eq(planItems.planId, studyPlans.id))
      .where(and(eq(planItems.id, itemId), eq(studyPlans.userId, userId)))
      .limit(1);
    return row ?? null;
  },
  async setCompletedAt(itemId, completedAt) {
    await db.update(planItems).set({ completedAt }).where(eq(planItems.id, itemId));
  },
};
