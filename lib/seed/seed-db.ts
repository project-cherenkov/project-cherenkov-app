// Database side of `pnpm db:seed` for the Phase 3 planner. The pure
// derivations (lib/seed/derive-syllabus-topics.ts, lib/quiz-bank) decide WHAT
// to write; this file writes it. It takes the database as a parameter, rather
// than importing lib/db, so it can be run against any Postgres-backed Drizzle
// instance.
import { and, eq, isNull, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { quizQuestions, topics } from "../db/schema";
import type { BankQuestion } from "../quiz-bank/types";
import type { DerivedSyllabusTopic } from "./derive-syllabus-topics";

// The concrete query-result and schema types differ per driver and do not
// matter here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SeedDb = PgDatabase<any, any, any>;

export interface SeedTopicsReport {
  upserted: number;
  // Legacy editorial-derived rows that were given a syllabus key in place.
  adopted: number;
  // Editorials whose link could not be kept because another row already
  // holds that editorial slug.
  editorialLinksSkipped: string[];
}

// Idempotent: running it twice leaves the same rows.
//
// A topics row that already exists for a linked editorial (created by the
// older editorial-driven seed) is ADOPTED — given its syllabus key in place —
// rather than duplicated, so existing quiz questions, attempts and plan items
// that point at its id keep working.
export async function seedSyllabusTopics(
  db: SeedDb,
  derived: DerivedSyllabusTopic[],
): Promise<SeedTopicsReport> {
  const report: SeedTopicsReport = {
    upserted: 0,
    adopted: 0,
    editorialLinksSkipped: [],
  };

  for (const t of derived) {
    let editorialSlug = t.editorialSlug;

    if (editorialSlug) {
      const adopted = await db
        .update(topics)
        .set({ syllabusTopicId: t.syllabusTopicId, sectionId: t.sectionId })
        .where(
          and(
            eq(topics.subject, t.subject),
            eq(topics.editorialSlug, editorialSlug),
            isNull(topics.syllabusTopicId),
            sql`not exists (
              select 1 from "topics" as other
              where other."subject" = ${t.subject}
                and other."syllabus_topic_id" = ${t.syllabusTopicId}
            )`,
          ),
        )
        .returning({ id: topics.id });
      report.adopted += adopted.length;

      // The slug is unique across topics; if some other row owns it, keep
      // that row as is and leave this syllabus topic unlinked.
      const [holder] = await db
        .select({
          subject: topics.subject,
          syllabusTopicId: topics.syllabusTopicId,
        })
        .from(topics)
        .where(eq(topics.editorialSlug, editorialSlug))
        .limit(1);
      if (
        holder &&
        !(
          holder.subject === t.subject &&
          holder.syllabusTopicId === t.syllabusTopicId
        )
      ) {
        report.editorialLinksSkipped.push(editorialSlug);
        editorialSlug = null;
      }
    }

    await db
      .insert(topics)
      .values({
        subject: t.subject,
        syllabusTopicId: t.syllabusTopicId,
        sectionId: t.sectionId,
        chapter: t.chapter,
        title: t.title,
        order: t.order,
        editorialSlug,
      })
      .onConflictDoUpdate({
        target: [topics.subject, topics.syllabusTopicId],
        set: {
          sectionId: t.sectionId,
          chapter: t.chapter,
          title: t.title,
          order: t.order,
          ...(editorialSlug ? { editorialSlug } : {}),
        },
      });
    report.upserted += 1;
  }

  return report;
}

export interface SeedQuizReport {
  upserted: number;
  // Keys of bank questions whose syllabus topic has no topics row yet
  // (run the topic seed first).
  skippedNoTopic: string[];
}

// Idempotent on `key`. Re-seeding overwrites a question's text, answer,
// difficulty and status with what the bank says — the bank is the source of
// truth — and keeps its row id, so recorded responses stay attached. Never
// reuse a key for a question that means something else.
export async function seedQuizBank(
  db: SeedDb,
  bank: BankQuestion[],
): Promise<SeedQuizReport> {
  const report: SeedQuizReport = { upserted: 0, skippedNoTopic: [] };

  for (const q of bank) {
    const [topic] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(
        and(
          eq(topics.subject, q.subject),
          eq(topics.syllabusTopicId, q.topicId),
        ),
      )
      .limit(1);

    if (!topic) {
      report.skippedNoTopic.push(q.key);
      continue;
    }

    const values = {
      topicId: topic.id,
      prompt: q.prompt,
      choices: q.choices,
      correctChoiceIndex: q.correctChoiceIndex,
      explanation: q.explanation,
      difficulty: q.difficulty,
      status: q.status,
    };

    await db
      .insert(quizQuestions)
      .values({ key: q.key, ...values })
      .onConflictDoUpdate({
        target: quizQuestions.key,
        targetWhere: sql`${quizQuestions.key} is not null`,
        set: values,
      });
    report.upserted += 1;
  }

  return report;
}

// Questions created before the bank existed have no key and so are never
// touched by seedQuizBank. They are counted so the script can say so, and
// deleted only when the operator explicitly asks.
export async function countKeylessQuestions(db: SeedDb): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quizQuestions)
    .where(isNull(quizQuestions.key));
  return row?.n ?? 0;
}

export async function deleteKeylessQuestions(db: SeedDb): Promise<number> {
  const deleted = await db
    .delete(quizQuestions)
    .where(isNull(quizQuestions.key))
    .returning({ id: quizQuestions.id });
  return deleted.length;
}
