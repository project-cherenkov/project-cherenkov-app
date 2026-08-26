import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizAttempts, topics, studyPlans, planItems } from "@/lib/db/schema";

export const MASTERY_THRESHOLD = 0.8;

export type TopicStatus = "done" | "in_progress" | "not_started";

export interface AttemptRecord {
  score: number;
  attemptedAt: Date | string;
}

// PLANNER-001. Decision #5: status is derived from the MOST RECENT attempt
// only, never the best score ever achieved — a later, worse retake can move
// a topic from `done` back to `in_progress` (spec §6 boundary case). Pure
// and DB-free so §8's required test ("[0.9, 0.5] in that order -> in
// progress; [0.5, 0.9] -> done") needs no database.
export function deriveStatusFromAttempts(
  attempts: AttemptRecord[],
): TopicStatus {
  if (attempts.length === 0) return "not_started";

  const [mostRecent] = [...attempts].sort(
    (a, b) => +new Date(b.attemptedAt) - +new Date(a.attemptedAt),
  );

  return mostRecent!.score >= MASTERY_THRESHOLD ? "done" : "in_progress";
}

export type Topic = typeof topics.$inferSelect;

export interface TopicWithStatus {
  topic: Topic;
  status: TopicStatus;
}

// PLANNER-001 constraint: this module is the single source of truth for
// deriving topic status from quiz_attempts — no other file (planner pages,
// plan-generation, quiz UI) queries quiz_attempts directly for status
// purposes (spec §6). Decision #6: progress is computed at read time, not
// stored in a separate mutable table.
export async function getTopicStatus(
  userId: string,
  topicId: string,
): Promise<TopicStatus> {
  const attempts = await db
    .select({
      score: quizAttempts.score,
      attemptedAt: quizAttempts.attemptedAt,
    })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.topicId, topicId)),
    );

  return deriveStatusFromAttempts(attempts);
}

// Two queries total regardless of topic count (all topics once, all of this
// user's attempts once), rather than one query per topic.
export async function getAllProgress(
  userId: string,
): Promise<TopicWithStatus[]> {
  const [allTopics, attempts] = await Promise.all([
    db.select().from(topics),
    db
      .select({
        topicId: quizAttempts.topicId,
        score: quizAttempts.score,
        attemptedAt: quizAttempts.attemptedAt,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId)),
  ]);

  const attemptsByTopic = new Map<string, AttemptRecord[]>();
  for (const attempt of attempts) {
    const list = attemptsByTopic.get(attempt.topicId) ?? [];
    list.push({ score: attempt.score, attemptedAt: attempt.attemptedAt });
    attemptsByTopic.set(attempt.topicId, list);
  }

  return [...allTopics]
    .sort((a, b) => a.order - b.order)
    .map((topic) => ({
      topic,
      status: deriveStatusFromAttempts(attemptsByTopic.get(topic.id) ?? []),
    }));
}

// PLANNER-003 route lookup: /[locale]/planner/[subject]/[chapter] resolves
// `chapter` against topics.chapter directly (docs/phase-2-architecture.md:
// "topics ... mirrors the archive's subject/principle taxonomy" — chapter
// is seeded from each editorial's `principle`, an already URL-safe slug —
// see lib/seed/derive-topics.ts).
export const VALID_SUBJECTS = ["informatics", "physics", "astronomy"] as const;
export type Subject = (typeof VALID_SUBJECTS)[number];

export function isValidSubject(value: string): value is Subject {
  return (VALID_SUBJECTS as readonly string[]).includes(value);
}

export async function getTopicBySubjectAndChapter(
  subject: string,
  chapter: string,
): Promise<Topic | null> {
  if (!isValidSubject(subject)) return null;

  const [topic] = await db
    .select()
    .from(topics)
    .where(and(eq(topics.subject, subject), eq(topics.chapter, chapter)))
    .limit(1);

  return topic ?? null;
}

export interface PlanItemWithTopic {
  topic: Topic;
  status: TopicStatus;
  scheduledFor: string;
  completedAt: Date | null;
}

export interface UserPlan {
  hasPlan: boolean;
  targetExamDate: string | null;
  items: PlanItemWithTopic[];
}

// Backs the planner overview page (PLANNER-003): whether the user has a
// study_plans row yet (decision: no plan -> "generate your plan" prompt,
// not an error and not a silently-empty page — spec §6), and if so, each
// plan_item joined with its topic and PLANNER-001's derived status.
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const [plan] = await db
    .select()
    .from(studyPlans)
    .where(eq(studyPlans.userId, userId))
    .limit(1);

  if (!plan) {
    return { hasPlan: false, targetExamDate: null, items: [] };
  }

  const [rows, progress] = await Promise.all([
    db
      .select({
        topic: topics,
        scheduledFor: planItems.scheduledFor,
        completedAt: planItems.completedAt,
      })
      .from(planItems)
      .innerJoin(topics, eq(planItems.topicId, topics.id))
      .where(eq(planItems.planId, plan.id)),
    getAllProgress(userId),
  ]);

  const statusByTopicId = new Map(
    progress.map((p) => [p.topic.id, p.status] as const),
  );

  const items: PlanItemWithTopic[] = rows
    .map((row) => ({
      topic: row.topic,
      status: statusByTopicId.get(row.topic.id) ?? "not_started",
      scheduledFor: row.scheduledFor,
      completedAt: row.completedAt,
    }))
    .sort(
      (a, b) =>
        a.scheduledFor.localeCompare(b.scheduledFor) ||
        a.topic.order - b.topic.order,
    );

  return { hasPlan: true, targetExamDate: plan.targetExamDate, items };
}
