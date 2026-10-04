"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  topics,
  topicSelfRatings,
  userPlannerSettings,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth-guard";
import { isValidTimeZone, todayInTimeZone } from "@/lib/osn-stages";
import {
  saveSelfRatingsCore,
  savePlannerSettingsCore,
  type PlannerSettings,
  type SaveRatingsResult,
  type SaveSettingsResult,
  type SelfRatingDeps,
  type SettingsDeps,
} from "@/lib/planner-settings";
import { DEFAULT_PLANNER_TIMEZONE } from "@/lib/planner-vocab";

// Only the two server actions are exported from this file — see the note at
// the top of lib/planner-settings.ts. The user is always taken from the
// session, never from the request.

export type SavePlannerSettingsResult =
  | SaveSettingsResult
  | { ok: false; unauthenticated: true };

export type SaveTopicRatingsResult =
  | SaveRatingsResult
  | { ok: false; reason: "unauthenticated" };

async function getSettings(userId: string): Promise<PlannerSettings | null> {
  const [row] = await db
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
}

const settingsDeps: SettingsDeps = {
  getSettings,
  async upsertSettings(userId, s) {
    await db
      .insert(userPlannerSettings)
      .values({ userId, ...s })
      .onConflictDoUpdate({
        target: userPlannerSettings.userId,
        set: { ...s },
      });
  },
};

const ratingDeps: SelfRatingDeps = {
  getSettings,
  async getTopicRowIds(subject, syllabusTopicIds) {
    const rows = await db
      .select({ id: topics.id, syllabusTopicId: topics.syllabusTopicId })
      .from(topics)
      .where(
        and(
          eq(topics.subject, subject),
          inArray(topics.syllabusTopicId, syllabusTopicIds),
        ),
      );
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.syllabusTopicId) map.set(row.syllabusTopicId, row.id);
    }
    return map;
  },
  async upsertRatings(userId, rows) {
    if (rows.length === 0) return;
    const ratedAt = new Date();
    await db
      .insert(topicSelfRatings)
      .values(rows.map((r) => ({ userId, topicId: r.topicId, rating: r.rating, ratedAt })))
      .onConflictDoUpdate({
        target: [topicSelfRatings.userId, topicSelfRatings.topicId],
        set: {
          rating: sql`excluded.rating`,
          ratedAt,
        },
      });
  },
};

// Saves subject, stage, exam year, weekly hours and time zone. When the
// result says `subjectChanged`, regenerate the student's plan.
export async function savePlannerSettings(
  input: unknown,
): Promise<SavePlannerSettingsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, unauthenticated: true };

  // "Not already over" is judged in the student's zone: the zone they are
  // submitting now if it is valid, else the one on file, else the default.
  const submittedZone = (input as { timezone?: unknown } | null)?.timezone;
  const zone =
    typeof submittedZone === "string" && isValidTimeZone(submittedZone)
      ? submittedZone
      : ((await getSettings(user.id))?.timezone ?? DEFAULT_PLANNER_TIMEZONE);

  return savePlannerSettingsCore(
    settingsDeps,
    user.id,
    input,
    todayInTimeZone(new Date(), zone),
  );
}

// Saves the student's 1–5 self-rating per syllabus topic (latest rating wins).
export async function saveTopicSelfRatings(
  input: unknown,
): Promise<SaveTopicRatingsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  return saveSelfRatingsCore(ratingDeps, user.id, input);
}
