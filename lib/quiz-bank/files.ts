import { QUESTION_DIFFICULTIES, QUESTION_STATUSES } from "../planner-vocab";
import type { Subject } from "../subjects";
import { quizKey } from "./key";
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
  prompt?: string;
  choices?: ReadonlyArray<{ text?: string; correct?: boolean }>;
  explanation?: string;
  author?: string;
  source?: string;
}

export interface ParsedQuizFile {
  question: BankQuestion | null;
  problems: string[];
}

// Turns one entry (file name = `key`) into a BankQuestion. A question that
// cannot be turned into one safely (no single correct choice, unknown
// difficulty or status) yields `question: null` plus the reasons, so a CI run
// reports every problem at once instead of stopping at the first.
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

  const choices = data.choices ?? [];
  const correct = choices
    .map((choice, index) => (choice.correct ? index : -1))
    .filter((index) => index >= 0);
  if (correct.length !== 1) {
    problems.push(
      `${where}: exactly one choice must be marked correct (found ${correct.length})`,
    );
  }

  const difficulty = data.difficulty;
  const difficultyOk = (QUESTION_DIFFICULTIES as readonly unknown[]).includes(difficulty);
  if (!difficultyOk) problems.push(`${where}: missing or unknown difficulty`);
  const status = data.status;
  const statusOk = (QUESTION_STATUSES as readonly unknown[]).includes(status);
  if (!statusOk) problems.push(`${where}: missing or unknown status`);
  if (!data.topic) problems.push(`${where}: no topic selected`);

  // Without these four there is nothing safe to build a question from.
  if (correct.length !== 1 || !difficultyOk || !statusOk || !data.topic) {
    return { question: null, problems };
  }

  const question: BankQuestion = {
    key,
    subject,
    topicId: data.topic as string,
    difficulty: difficulty as BankQuestion["difficulty"],
    prompt: data.prompt ?? "",
    choices: choices.map((choice) => choice.text ?? ""),
    correctChoiceIndex: correct[0] as number,
    explanation: data.explanation ?? "",
    status: status as BankQuestion["status"],
    archived: data.archived === true,
    ...(data.author ? { author: data.author } : {}),
    ...(data.source ? { source: data.source } : {}),
  };
  return { question, problems };
}

// ---- writing ---------------------------------------------------------------

const PLAIN = /^[a-z0-9][a-z0-9.-]*$/;

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

// Same fields, same order, and same shape that Keystatic writes for the
// collection, so the first time someone saves a migrated question in
// Keystatic the diff stays small. Optional fields are left out when empty.
export function serializeQuizFile(q: BankQuestion): string {
  const out: string[] = [];
  const plain = (key: string, value: string) =>
    out.push(`${key}: ${PLAIN.test(value) ? value : JSON.stringify(value)}`);

  plain("questionId", q.key);
  plain("topic", q.topicId);
  plain("difficulty", q.difficulty);
  plain("status", q.status);
  out.push(`archived: ${q.archived ? "true" : "false"}`);
  out.push(...emitText("prompt", q.prompt, 0, ""));
  out.push("choices:");
  q.choices.forEach((choice, index) => {
    out.push(...emitText("text", choice, 4, "  - "));
    out.push(`    correct: ${index === q.correctChoiceIndex ? "true" : "false"}`);
  });
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
