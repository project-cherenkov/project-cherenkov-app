import type { QuestionDifficulty, QuestionStatus } from "../planner-vocab";
import type { Subject } from "../subjects";
import { nextFreeKey } from "./files";
import type { BankQuestion } from "./types";

// Plans moving database-only questions (admin.<uuid> keys, made in the old
// admin page) into git. Pure: scripts/export-db-quiz-questions.ts does the
// reading, writing and the key rename.

export interface DbOnlyQuestionRow {
  id: string;
  key: string | null;
  subject: Subject;
  // topics.syllabus_topic_id; null for a legacy editorial-derived topics row.
  syllabusTopicId: string | null;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  archived: boolean;
}

export interface PlannedExport {
  rowId: string;
  oldKey: string | null;
  question: BankQuestion;
}

export interface ExportPlan {
  exports: PlannedExport[];
  // Rows that cannot be exported, with the reason.
  skipped: Array<{ rowId: string; key: string | null; reason: string }>;
}

// `takenKeys` must hold every key already in use: all content/quiz files AND
// every key in the database, so a new key can neither collide with a file nor
// with an existing row (quiz_questions.key is unique).
export function planDbExport(
  rows: DbOnlyQuestionRow[],
  takenKeys: ReadonlySet<string>,
): ExportPlan {
  const taken = new Set(takenKeys);
  const plan: ExportPlan = { exports: [], skipped: [] };

  // Deterministic numbering regardless of the order the database returns rows.
  const ordered = [...rows].sort((a, b) =>
    `${a.subject}.${a.syllabusTopicId}.${a.difficulty}.${a.id}`.localeCompare(
      `${b.subject}.${b.syllabusTopicId}.${b.difficulty}.${b.id}`,
    ),
  );

  for (const row of ordered) {
    if (!row.syllabusTopicId) {
      plan.skipped.push({
        rowId: row.id,
        key: row.key,
        reason: "its topic has no syllabus id (a legacy topics row); re-attach it to a syllabus topic first",
      });
      continue;
    }
    if (row.correctChoiceIndex < 0 || row.correctChoiceIndex >= row.choices.length) {
      plan.skipped.push({ rowId: row.id, key: row.key, reason: "its correct-choice index is outside its choices" });
      continue;
    }
    const key = nextFreeKey(row.subject, row.syllabusTopicId, row.difficulty, taken);
    taken.add(key);
    plan.exports.push({
      rowId: row.id,
      oldKey: row.key,
      question: {
        key,
        subject: row.subject,
        topicId: row.syllabusTopicId,
        difficulty: row.difficulty,
        prompt: row.prompt,
        choices: row.choices,
        correctChoiceIndex: row.correctChoiceIndex,
        explanation: row.explanation ?? "",
        status: row.status,
        archived: row.archived,
        source: "Moved from the database-only admin page",
      },
    });
  }
  return plan;
}
