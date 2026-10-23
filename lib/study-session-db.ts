// Real Drizzle reads/writes for study sessions and "understood" marks.
// Server-only and NOT a "use server" module: every function takes a userId.
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  planItems,
  quizAttempts,
  studyPlans,
  studySessions,
  topics,
  understoodMarks,
} from "@/lib/db/schema";
import type { StudySessionDeps } from "@/lib/study-session";
import type { Subject } from "@/lib/subjects";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const studySessionDeps: StudySessionDeps = {
  async ownsPlanItem(userId, planItemId) {
    if (!UUID_RE.test(planItemId)) return false;
    const [row] = await db
      .select({ id: planItems.id })
      .from(planItems)
      .innerJoin(studyPlans, eq(planItems.planId, studyPlans.id))
      .where(and(eq(planItems.id, planItemId), eq(studyPlans.userId, userId)))
      .limit(1);
    return Boolean(row);
  },
  async hasOverlap(userId, startedAt, endsAt) {
    // Existing session [s, s + d) overlaps the new [start, end) when
    // s < end AND s + d > start.
    const [row] = await db
      .select({ id: studySessions.id })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          lt(studySessions.startedAt, endsAt),
          // The bound value is an explicit UTC ISO string cast to `timestamp`,
          // matching how Drizzle stores these columns. Passing a raw Date here
          // would be serialized by the driver in the SERVER's time zone and
          // shift the comparison on any machine that is not running in UTC.
          sql`${studySessions.startedAt} + make_interval(secs => ${studySessions.durationSeconds}) > ${startedAt.toISOString()}::timestamp`,
        ),
      )
      .limit(1);
    return Boolean(row);
  },
  async insertSession(row) {
    const [inserted] = await db
      .insert(studySessions)
      .values({
        userId: row.userId,
        subject: row.subject,
        syllabusTopicId: row.syllabusTopicId,
        planItemId: row.planItemId,
        startedAt: row.startedAt,
        durationSeconds: row.durationSeconds,
        source: row.source,
      })
      .returning({ id: studySessions.id });
    return inserted!.id;
  },
};

export async function deleteOwnedSession(userId: string, sessionId: string): Promise<boolean> {
  if (!UUID_RE.test(sessionId)) return false;
  const deleted = await db
    .delete(studySessions)
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
    .returning({ id: studySessions.id });
  return deleted.length > 0;
}

export interface SessionRow {
  id: string;
  subject: Subject | null;
  syllabusTopicId: string | null;
  startedAt: Date;
  durationSeconds: number;
  source: string;
}

export async function loadSessionsSince(userId: string, since: Date): Promise<SessionRow[]> {
  return db
    .select({
      id: studySessions.id,
      subject: studySessions.subject,
      syllabusTopicId: studySessions.syllabusTopicId,
      startedAt: studySessions.startedAt,
      durationSeconds: studySessions.durationSeconds,
      source: studySessions.source,
    })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, since)))
    .orderBy(desc(studySessions.startedAt));
}

export async function loadAttemptTimesSince(userId: string, since: Date): Promise<Date[]> {
  const rows = await db
    .select({ at: quizAttempts.attemptedAt })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), gte(quizAttempts.attemptedAt, since)));
  return rows.map((r) => r.at);
}

export interface TimerPlanItem {
  id: string;
  scheduledFor: string;
  kind: string;
  minutes: number | null;
  subject: Subject;
  syllabusTopicId: string;
}

// Open plan items for the timer's "attach to a plan item" picker: the earliest
// unfinished ones, scheduled on or before `today` (in the student's zone).
export async function loadOpenPlanItems(
  userId: string,
  today: string,
  limit = 20,
): Promise<TimerPlanItem[]> {
  const rows = await db
    .select({
      id: planItems.id,
      scheduledFor: planItems.scheduledFor,
      kind: planItems.kind,
      minutes: planItems.minutes,
      subject: topics.subject,
      syllabusTopicId: topics.syllabusTopicId,
    })
    .from(planItems)
    .innerJoin(studyPlans, eq(planItems.planId, studyPlans.id))
    .innerJoin(topics, eq(planItems.topicId, topics.id))
    .where(
      and(
        eq(studyPlans.userId, userId),
        isNull(planItems.completedAt),
        sql`${planItems.scheduledFor} <= ${today}`,
      ),
    )
    .orderBy(asc(planItems.scheduledFor), asc(planItems.position))
    .limit(limit);
  return rows.flatMap((r) =>
    r.syllabusTopicId ? [{ ...r, syllabusTopicId: r.syllabusTopicId }] : [],
  );
}

export async function loadPlannedMinutesBetween(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${planItems.minutes}), 0)::int` })
    .from(planItems)
    .innerJoin(studyPlans, eq(planItems.planId, studyPlans.id))
    .where(
      and(
        eq(studyPlans.userId, userId),
        sql`${planItems.scheduledFor} >= ${fromDate}`,
        sql`${planItems.scheduledFor} <= ${toDate}`,
      ),
    );
  return row?.total ?? 0;
}

// --- "Understood" marks ------------------------------------------------------

export type UnderstoodKind = "material" | "editorial";

export async function isUnderstood(
  userId: string,
  kind: UnderstoodKind,
  subject: Subject,
  slug: string,
): Promise<boolean> {
  const [row] = await db
    .select({ slug: understoodMarks.slug })
    .from(understoodMarks)
    .where(
      and(
        eq(understoodMarks.userId, userId),
        eq(understoodMarks.kind, kind),
        eq(understoodMarks.subject, subject),
        eq(understoodMarks.slug, slug),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function setUnderstood(
  userId: string,
  kind: UnderstoodKind,
  subject: Subject,
  slug: string,
  understood: boolean,
): Promise<void> {
  if (understood) {
    await db
      .insert(understoodMarks)
      .values({ userId, kind, subject, slug })
      .onConflictDoNothing();
    return;
  }
  await db
    .delete(understoodMarks)
    .where(
      and(
        eq(understoodMarks.userId, userId),
        eq(understoodMarks.kind, kind),
        eq(understoodMarks.subject, subject),
        eq(understoodMarks.slug, slug),
      ),
    );
}

export async function loadUnderstoodMarks(
  userId: string,
): Promise<{ kind: UnderstoodKind; subject: Subject; slug: string }[]> {
  const rows = await db
    .select({
      kind: understoodMarks.kind,
      subject: understoodMarks.subject,
      slug: understoodMarks.slug,
    })
    .from(understoodMarks)
    .where(eq(understoodMarks.userId, userId));
  return rows.flatMap((r) =>
    r.kind === "material" || r.kind === "editorial"
      ? [{ kind: r.kind, subject: r.subject, slug: r.slug }]
      : [],
  );
}
