// Database side of `pnpm db:seed` for the Phase 3 planner. The pure
// derivations (lib/seed/derive-syllabus-topics.ts, lib/quiz-bank) decide WHAT
// to write; this file writes it. It takes the database as a parameter, rather
// than importing lib/db, so it can be run against any Postgres-backed Drizzle
// instance.
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { quizQuestions, topics } from "../db/schema";
import {
  planQuizSync,
  type ExistingQuizRow,
  type QuizTopicRow,
} from "../quiz-bank/sync";
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

export interface SyncQuizReport {
  inserted: number;
  updated: number;
  unchanged: number;
  // Keys archived because their file no longer exists (never deleted).
  archivedMissing: string[];
  // Keys whose syllabus topic has no topics row yet (run the topic seed first).
  skippedNoTopic: string[];
  // Archived in the database but not in the file; see lib/quiz-bank/sync.ts.
  databaseOnlyArchived: string[];
  // Rows the sync does not manage (admin.* keys and keyless legacy rows).
  unmanaged: number;
}

// Syncs content/quiz (the loaded bank) into quiz_questions. Git is the source
// of truth for a keyed question's content; the rules (never delete, only ever
// archive, leave admin.* and keyless rows alone) live in
// lib/quiz-bank/sync.ts, where they are unit-tested. Safe to run repeatedly.
// Statements run one after another (no transaction): the Neon HTTP driver does
// not offer one, and every statement is independently idempotent.
export async function syncQuizBank(
  db: SeedDb,
  bank: BankQuestion[],
): Promise<SyncQuizReport> {
  if (bank.length === 0) {
    throw new Error(
      "Refusing to sync an empty quiz bank: that would archive every git-managed question. Check that content/quiz exists and loads.",
    );
  }

  const topicRows = (await db
    .select({ id: topics.id, subject: topics.subject, syllabusTopicId: topics.syllabusTopicId })
    .from(topics)) as QuizTopicRow[];
  const existing = (await db
    .select({
      id: quizQuestions.id,
      key: quizQuestions.key,
      topicId: quizQuestions.topicId,
      prompt: quizQuestions.prompt,
      choices: quizQuestions.choices,
      correctChoiceIndex: quizQuestions.correctChoiceIndex,
      explanation: quizQuestions.explanation,
      difficulty: quizQuestions.difficulty,
      status: quizQuestions.status,
      archived: quizQuestions.archived,
    })
    .from(quizQuestions)
    .where(isNotNull(quizQuestions.key))) as ExistingQuizRow[];
  // Keyless rows are not selected above (they are not managed); count them
  // separately so the report can say so.
  const keyless = await countKeylessQuestions(db);

  const plan = planQuizSync(bank, existing, topicRows);

  if (plan.inserts.length > 0) {
    await db
      .insert(quizQuestions)
      .values(plan.inserts)
      .onConflictDoNothing({
        target: quizQuestions.key,
        where: sql`${quizQuestions.key} is not null`,
      });
  }
  for (const update of plan.updates) {
    await db.update(quizQuestions).set(update.set).where(eq(quizQuestions.id, update.id));
  }
  for (const missing of plan.archiveMissing) {
    await db.update(quizQuestions).set({ archived: true }).where(eq(quizQuestions.id, missing.id));
  }

  return {
    inserted: plan.inserts.length,
    updated: plan.updates.length,
    unchanged: plan.unchanged,
    archivedMissing: plan.archiveMissing.map((row) => row.key),
    skippedNoTopic: plan.skippedNoTopic,
    databaseOnlyArchived: plan.databaseOnlyArchived,
    unmanaged: plan.unmanaged + keyless,
  };
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
