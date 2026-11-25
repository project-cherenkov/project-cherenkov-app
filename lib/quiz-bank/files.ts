import { QUESTION_DIFFICULTIES, QUESTION_STATUSES } from "../planner-vocab";
import type { Subject } from "../subjects";
import { quizKey } from "./key";
import { DEFAULT_QUESTION_TYPE, isQuestionType, type QuestionType } from "../quiz-types";
import type { BankQuestion } from "./types";

// Pure helpers for the content/quiz/<subject>/<key>.yaml files that Keystatic
// edits (collections `<subject>Questions` in keystatic.config.ts). No file or
// database access here — see load.ts for reading and
// scripts/export-db-quiz-questions.ts for writing.

export const QUIZ_CONTENT_ROOT = "content/quiz";

export function quizFilePath(subject: Subject, key: string): string {
  return `${QUIZ_CONTENT_ROOT}/${subject}/${key}.yaml`;
}

// The shape Keystatic's reader returns for a question entry. Everything is
// optional/loose on purpose: a hand-edited file may be missing fields, and
// the problems list below is how that is reported.
export interface QuizFileData {
  questionId?: string;
  topic?: string;
  difficulty?: string;
  status?: string;
  archived?: boolean;
  // Absent in legacy files, which are single_choice.
  questionType?: string;
  prompt?: string;
  choices?: ReadonlyArray<{ text?: string; correct?: boolean }>;
  statements?: ReadonlyArray<{ text?: string; isTrue?: boolean }>;
  numericAnswer?: {
    value?: number | null;
    tolerance?: number | null;
    unit?: string | null;
  } | null;
  explanation?: string;
  author?: string;
  source?: string;
}

export interface ParsedQuizFile {
  question: BankQuestion | null;
  problems: string[];
}

// Turns one entry (file name = `key`) into a BankQuestion. A question that
// cannot be turned into one safely (unknown type, wrong correct-answer count,
// unknown difficulty or status) yields `question: null` plus the reasons, so a
// CI run reports every problem at once instead of stopping at the first.
//
// Per-type structure (counts, duplicates, tolerance ranges) is checked by
// validateQuizBank; this parser only refuses what it cannot represent.
export function parseQuizFile(
  subject: Subject,
  key: string,
  data: QuizFileData,
): ParsedQuizFile {
  const where = `${QUIZ_CONTENT_ROOT}/${subject}/${key}.yaml`;
  const problems: string[] = [];

  if (data.questionId !== undefined && data.questionId !== key) {
    problems.push(
      `${where}: Question ID "${data.questionId}" does not match the file name "${key}"`,
    );
  }

  const legacy = data.questionType === undefined;
  const rawType = data.questionType ?? DEFAULT_QUESTION_TYPE;
  const typeOk = isQuestionType(rawType);
  if (!typeOk) problems.push(`${where}: unknown questionType "${String(rawType)}"`);

  const difficulty = data.difficulty;
  const difficultyOk = (QUESTION_DIFFICULTIES as readonly unknown[]).includes(difficulty);
  if (!difficultyOk) problems.push(`${where}: missing or unknown difficulty`);
  const status = data.status;
  const statusOk = (QUESTION_STATUSES as readonly unknown[]).includes(status);
  if (!statusOk) problems.push(`${where}: missing or unknown status`);
  if (!data.topic) problems.push(`${where}: no topic selected`);

  const choices = data.choices ?? [];
  const statements = data.statements ?? [];
  const numeric = data.numericAnswer ?? null;
  const numericSet =
    numeric !== null &&
    ((numeric.value !== null && numeric.value !== undefined) ||
      (numeric.tolerance !== null && numeric.tolerance !== undefined) ||
      (numeric.unit ?? "").trim() !== "");

  // Fields that belong to another type are a mistake worth reporting: they
  // would be silently ignored otherwise.
  if (typeOk) {
    const isChoice = rawType === "single_choice" || rawType === "multiple_select";
    if (!isChoice && choices.length > 0) problems.push(`${where}: ${rawType} must not have choices`);
    if (rawType !== "true_false_set" && statements.length > 0) {
      problems.push(`${where}: ${rawType} must not have statements`);
    }
    if (rawType !== "numeric_response" && numericSet) {
      problems.push(`${where}: ${rawType} must not have numericAnswer`);
    }
  }

  const base = {
    key,
    subject,
    topicId: data.topic as string,
    difficulty: difficulty as BankQuestion["difficulty"],
    prompt: data.prompt ?? "",
    explanation: data.explanation ?? "",
    status: status as BankQuestion["status"],
    archived: data.archived === true,
    ...(data.author ? { author: data.author } : {}),
    ...(data.source ? { source: data.source } : {}),
    ...(legacy ? { legacy: true as const } : {}),
  };

  // Without these there is nothing safe to build a question from.
  if (!typeOk || !difficultyOk || !statusOk || !data.topic) return { question: null, problems };

  switch (rawType as QuestionType) {
    case "single_choice": {
      const correct = indicesOf(choices.map((c) => c.correct === true));
      if (correct.length !== 1) {
        problems.push(`${where}: exactly one choice must be marked correct (found ${correct.length})`);
        return { question: null, problems };
      }
      return {
        question: {
          ...base,
          questionType: "single_choice",
          choices: choices.map((c) => c.text ?? ""),
          correctChoiceIndex: correct[0] as number,
        },
        problems,
      };
    }
    case "multiple_select": {
      const correct = indicesOf(choices.map((c) => c.correct === true));
      if (correct.length === 0) {
        problems.push(`${where}: multiple_select needs at least two correct choices (found 0)`);
        return { question: null, problems };
      }
      return {
        question: {
          ...base,
          questionType: "multiple_select",
          choices: choices.map((c) => c.text ?? ""),
          correctChoiceIndices: correct,
        },
        problems,
      };
    }
    case "true_false_set":
      return {
        question: {
          ...base,
          questionType: "true_false_set",
          statements: statements.map((s) => ({ text: s.text ?? "", isTrue: s.isTrue === true })),
        },
        problems,
      };
    case "numeric_response": {
      const value = numeric?.value;
      const tolerance = numeric?.tolerance;
      if (typeof value !== "number" || typeof tolerance !== "number") {
        problems.push(`${where}: numericAnswer needs a value and a tolerance`);
        return { question: null, problems };
      }
      return {
        question: {
          ...base,
          questionType: "numeric_response",
          numericAnswer: { value, tolerance, unit: numeric?.unit ?? "" },
        },
        problems,
      };
    }
  }
}

function indicesOf(flags: boolean[]): number[] {
  return flags.flatMap((flag, index) => (flag ? [index] : []));
}

// ---- writing ---------------------------------------------------------------

const PLAIN = /^[a-z0-9][a-z0-9._-]*$/;

// One YAML scalar for `<key>: <value>` where `key` sits at column `column`.
// Single-line text is always double-quoted (JSON string syntax is valid YAML),
// which sidesteps every "is this a number / boolean / null?" trap. Multi-line
// text uses a literal block scalar so it stays readable in a diff; anything a
// block scalar cannot carry faithfully falls back to the quoted form.
function emitText(key: string, value: string, column: number, prefix: string): string[] {
  const lines = value.split("\n");
  const blockSafe =
    lines.length > 1 &&
    !value.includes("\r") &&
    !value.startsWith(" ") &&
    !value.startsWith("\t") &&
    !value.startsWith("\n") &&
    !value.endsWith("\n") &&
    lines.every((line) => line === line.trimEnd());
  if (!blockSafe) return [`${prefix}${key}: ${JSON.stringify(value)}`];
  const pad = " ".repeat(column + 2);
  return [`${prefix}${key}: |-`, ...lines.map((line) => (line === "" ? "" : pad + line))];
}

function emitNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot write a non-finite number to YAML: ${value}`);
  return Object.is(value, -0) ? "0" : String(value);
}

// Same fields, same order, and same shape that Keystatic writes for the
// collection, so the first time someone saves a migrated question in
// Keystatic the diff stays small. Optional fields are left out when empty.
// A legacy question (no `questionType` in its file) is written back without
// one, exactly as it was read.
export function serializeQuizFile(q: BankQuestion): string {
  const out: string[] = [];
  const plain = (key: string, value: string) =>
    out.push(`${key}: ${PLAIN.test(value) ? value : JSON.stringify(value)}`);

  plain("questionId", q.key);
  plain("topic", q.topicId);
  plain("difficulty", q.difficulty);
  plain("status", q.status);
  out.push(`archived: ${q.archived ? "true" : "false"}`);
  if (!(q.legacy && q.questionType === "single_choice")) plain("questionType", q.questionType);
  out.push(...emitText("prompt", q.prompt, 0, ""));
  switch (q.questionType) {
    case "single_choice":
    case "multiple_select": {
      const correct =
        q.questionType === "single_choice" ? [q.correctChoiceIndex] : q.correctChoiceIndices;
      out.push("choices:");
      q.choices.forEach((choice, index) => {
        out.push(...emitText("text", choice, 4, "  - "));
        out.push(`    correct: ${correct.includes(index) ? "true" : "false"}`);
      });
      break;
    }
    case "true_false_set":
      out.push("statements:");
      q.statements.forEach((statement) => {
        out.push(...emitText("text", statement.text, 4, "  - "));
        out.push(`    isTrue: ${statement.isTrue ? "true" : "false"}`);
      });
      break;
    case "numeric_response":
      out.push("numericAnswer:");
      out.push(`  value: ${emitNumber(q.numericAnswer.value)}`);
      out.push(`  tolerance: ${emitNumber(q.numericAnswer.tolerance)}`);
      out.push(...emitText("unit", q.numericAnswer.unit, 2, "  "));
      break;
  }
  out.push(...emitText("explanation", q.explanation, 0, ""));
  if (q.author) out.push(...emitText("author", q.author, 0, ""));
  if (q.source) out.push(...emitText("source", q.source, 0, ""));
  return out.join("\n") + "\n";
}

// Smallest unused number for a (subject, topic, difficulty) — how an exported
// database question gets its key without colliding with an existing one.
export function nextFreeKey(
  subject: Subject,
  topicId: string,
  difficulty: BankQuestion["difficulty"],
  taken: ReadonlySet<string>,
): string {
  for (let n = 1; ; n += 1) {
    const key = quizKey(subject, topicId, difficulty, n);
    if (!taken.has(key)) return key;
  }
}
