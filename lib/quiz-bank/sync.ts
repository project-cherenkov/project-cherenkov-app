import type { QuestionDifficulty, QuestionStatus } from "../planner-vocab";
import type { Subject } from "../subjects";
import { isGitManagedKey } from "./key";
import type { BankQuestion } from "./types";

// Decides WHAT the quiz sync writes; lib/seed/seed-db.ts (syncQuizBank) runs
// it. Pure, so every rule below is unit-tested without a database.
//
// The rules, in one place:
//  1. Git wins for content. A keyed question's topic, prompt, choices, correct
//     answer, explanation, difficulty and review status are overwritten from
//     the file whenever they differ. Editing them in the database is pointless.
//  2. Rows are never deleted. quiz_question_responses cascades on delete, so a
//     delete would erase students' answer history. A git-managed question whose
//     file is gone is ARCHIVED instead.
//  3. Archiving is one-way. A question is archived if the file says so OR the
//     database already has it archived. The sync never restores one; the admin
//     page's Restore button is the only way back. That keeps the emergency
//     "archive this now" switch safe across a re-sync.
//  4. Rows with an "admin.<uuid>" key (made in the old database-only admin
//     page) or no key are not git-managed and are left completely alone until
//     scripts/export-db-quiz-questions.ts moves them into git.

export interface QuizTopicRow {
  id: string;
  subject: Subject;
  syllabusTopicId: string | null;
}

export interface ExistingQuizRow {
  id: string;
  key: string | null;
  topicId: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  archived: boolean;
}

export interface QuizRowValues {
  topicId: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  archived: boolean;
}

export interface QuizSyncPlan {
  inserts: Array<QuizRowValues & { key: string }>;
  updates: Array<{ id: string; key: string; set: Partial<QuizRowValues> }>;
  // Git-managed rows whose file no longer exists (and that are not already
  // archived): they get archived, never deleted.
  archiveMissing: Array<{ id: string; key: string }>;
  // Bank questions whose syllabus topic has no topics row yet.
  skippedNoTopic: string[];
  unchanged: number;
  // Archived in the database but not in the file: restore from the admin page,
  // or set `archived` in the file so git matches reality.
  databaseOnlyArchived: string[];
  // Rows the sync does not manage (admin.* or keyless).
  unmanaged: number;
}

const sameChoices = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export function planQuizSync(
  bank: BankQuestion[],
  existing: ExistingQuizRow[],
  topicRows: QuizTopicRow[],
): QuizSyncPlan {
  const plan: QuizSyncPlan = {
    inserts: [],
    updates: [],
    archiveMissing: [],
    skippedNoTopic: [],
    unchanged: 0,
    databaseOnlyArchived: [],
    unmanaged: 0,
  };

  const topicIdByKey = new Map<string, string>();
  for (const row of topicRows) {
    if (row.syllabusTopicId) {
      topicIdByKey.set(`${row.subject}\u0000${row.syllabusTopicId}`, row.id);
    }
  }
  const existingByKey = new Map<string, ExistingQuizRow>();
  for (const row of existing) {
    if (isGitManagedKey(row.key)) existingByKey.set(row.key, row);
    else plan.unmanaged += 1;
  }

  const bankKeys = new Set<string>();
  for (const q of bank) {
    bankKeys.add(q.key);
    const topicId = topicIdByKey.get(`${q.subject}\u0000${q.topicId}`);
    if (!topicId) {
      plan.skippedNoTopic.push(q.key);
      continue;
    }

    const row = existingByKey.get(q.key);
    if (!row) {
      plan.inserts.push({
        key: q.key,
        topicId,
        prompt: q.prompt,
        choices: q.choices,
        correctChoiceIndex: q.correctChoiceIndex,
        explanation: q.explanation,
        difficulty: q.difficulty,
        status: q.status,
        archived: q.archived,
      });
      continue;
    }

    const archived = row.archived || q.archived;
    if (row.archived && !q.archived) plan.databaseOnlyArchived.push(q.key);

    const set: Partial<QuizRowValues> = {};
    if (row.topicId !== topicId) set.topicId = topicId;
    if (row.prompt !== q.prompt) set.prompt = q.prompt;
    if (!sameChoices(row.choices, q.choices)) set.choices = q.choices;
    if (row.correctChoiceIndex !== q.correctChoiceIndex) set.correctChoiceIndex = q.correctChoiceIndex;
    if ((row.explanation ?? "") !== q.explanation) set.explanation = q.explanation;
    if (row.difficulty !== q.difficulty) set.difficulty = q.difficulty;
    if (row.status !== q.status) set.status = q.status;
    if (row.archived !== archived) set.archived = archived;

    if (Object.keys(set).length === 0) plan.unchanged += 1;
    else plan.updates.push({ id: row.id, key: q.key, set });
  }

  // A non-empty bank is required before anything is archived for being
  // missing; syncQuizBank refuses an empty one outright, and this keeps the
  // planner safe on its own too (a failed content load must never archive
  // every question).
  if (bank.length > 0) {
    for (const [key, row] of existingByKey) {
      if (!bankKeys.has(key) && !row.archived) plan.archiveMissing.push({ id: row.id, key });
    }
  }

  return plan;
}
