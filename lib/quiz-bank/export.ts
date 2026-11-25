import type { QuestionDifficulty, QuestionStatus } from "../planner-vocab";
import type { Subject } from "../subjects";
import { nextFreeKey } from "./files";
import { parseQuestionContent, parseAnswerKey } from "../quiz-types";
import { joinQuestionData, type BankQuestion } from "./types";

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
  // Raw jsonb columns (public content and server-only answer key).
  content: unknown;
  answerKey: unknown;
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
    const content = parseQuestionContent(row.content);
    const answerKey = content ? parseAnswerKey(row.answerKey, content) : null;
    const data = content && answerKey ? joinQuestionData(content, answerKey) : null;
    if (!data) {
      plan.skipped.push({ rowId: row.id, key: row.key, reason: "its content or answer key is malformed" });
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
        explanation: row.explanation ?? "",
        status: row.status,
        archived: row.archived,
        source: "Moved from the database-only admin page",
        // The old admin page only made single-choice questions: they are
        // written as legacy files (no questionType, no author). Any other
        // type would be new-format and must name an author.
        ...(data.questionType === "single_choice"
          ? { legacy: true as const }
          : { author: "Moved from the database-only admin page" }),
        ...data,
      } as BankQuestion,
    });
  }
  return plan;
}
