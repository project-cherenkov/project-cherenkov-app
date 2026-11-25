// The four deterministic quiz question types and everything that is the same
// for all of them: the shapes of the public content, the server-only answer
// key, the student's submitted response, and the pure grading function.
//
// Dependency-free on purpose: keystatic.config.ts is bundled into the browser
// and the quiz UI is client code, so nothing here may import server modules.
//
// Privacy split (QUIZ-001): `QuestionContent` is what the browser may receive
// BEFORE submission; `AnswerKey` is only ever read server-side (and revealed
// after submission / on a permitted miss reveal). Never merge the two.

export const QUESTION_TYPES = [
  "single_choice",
  "multiple_select",
  "true_false_set",
  "numeric_response",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DEFAULT_QUESTION_TYPE: QuestionType = "single_choice";

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

// Contract limits (docs/engineering/quiz-authoring.md).
export const MIN_CHOICES_SINGLE = 2;
export const MIN_CHOICES_MULTIPLE = 3;
export const MIN_STATEMENTS = 3;
export const MAX_STATEMENTS = 5;

// ---- public content (safe to send to the browser) --------------------------

export type QuestionContent =
  | { type: "single_choice"; choices: string[] }
  | { type: "multiple_select"; choices: string[] }
  | { type: "true_false_set"; statements: string[] }
  | { type: "numeric_response"; unit: string };

// ---- server-only answer key -------------------------------------------------

export type AnswerKey =
  | { type: "single_choice"; correctChoiceIndex: number }
  // Sorted ascending, unique.
  | { type: "multiple_select"; correctChoiceIndices: number[] }
  // One boolean per statement, in statement order (`isTrue` in the YAML).
  | { type: "true_false_set"; truthValues: boolean[] }
  // Absolute tolerance in the unit shown to the student.
  | { type: "numeric_response"; value: number; tolerance: number };

// ---- what a student submits / what history stores ---------------------------

export type SubmittedResponse =
  | { type: "single_choice"; choiceIndex: number }
  | { type: "multiple_select"; choiceIndices: number[] }
  | { type: "true_false_set"; values: boolean[] }
  | { type: "numeric_response"; value: number };

// The answer shown to the student AFTER submission (or on a permitted miss
// reveal). Same data as the key, plus the unit so the UI can print it.
export type RevealedAnswer =
  | { type: "single_choice"; correctChoiceIndex: number }
  | { type: "multiple_select"; correctChoiceIndices: number[] }
  | { type: "true_false_set"; truthValues: boolean[] }
  | { type: "numeric_response"; value: number; tolerance: number; unit: string };

// A question as the SERVER sees it when scoring.
export interface ServerQuestion {
  id: string;
  content: QuestionContent;
  answerKey: AnswerKey;
}

// ---- helpers ----------------------------------------------------------------

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

// Defensive parse of the `content` jsonb column. Returns null for anything that
// is not a well-formed content object, so a corrupt row is skipped rather than
// served or scored.
export function parseQuestionContent(raw: unknown): QuestionContent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  switch (row.type) {
    case "single_choice":
    case "multiple_select":
      return isStringArray(row.choices) ? { type: row.type, choices: row.choices } : null;
    case "true_false_set":
      return isStringArray(row.statements) ? { type: "true_false_set", statements: row.statements } : null;
    case "numeric_response":
      return typeof row.unit === "string" ? { type: "numeric_response", unit: row.unit } : null;
    default:
      return null;
  }
}

// Defensive parse of the `answer_key` jsonb column, checked against the content
// so the two can never disagree about type or size.
export function parseAnswerKey(raw: unknown, content: QuestionContent): AnswerKey | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.type !== content.type) return null;
  switch (content.type) {
    case "single_choice": {
      const index = row.correctChoiceIndex;
      return Number.isInteger(index) && (index as number) >= 0 && (index as number) < content.choices.length
        ? { type: "single_choice", correctChoiceIndex: index as number }
        : null;
    }
    case "multiple_select": {
      const indices = row.correctChoiceIndices;
      if (!Array.isArray(indices) || indices.length === 0) return null;
      if (!indices.every((i) => Number.isInteger(i) && i >= 0 && i < content.choices.length)) return null;
      if (new Set(indices).size !== indices.length) return null;
      return { type: "multiple_select", correctChoiceIndices: [...(indices as number[])].sort((a, b) => a - b) };
    }
    case "true_false_set": {
      const values = row.truthValues;
      return Array.isArray(values) &&
        values.length === content.statements.length &&
        values.every((v) => typeof v === "boolean")
        ? { type: "true_false_set", truthValues: values as boolean[] }
        : null;
    }
    case "numeric_response":
      return isFiniteNumber(row.value) && isFiniteNumber(row.tolerance) && row.tolerance >= 0
        ? { type: "numeric_response", value: row.value, tolerance: row.tolerance }
        : null;
  }
}

// Builds a ServerQuestion from the raw jsonb columns, or null if either is bad.
export function toServerQuestion(
  id: string,
  rawContent: unknown,
  rawKey: unknown,
): ServerQuestion | null {
  const content = parseQuestionContent(rawContent);
  if (!content) return null;
  const answerKey = parseAnswerKey(rawKey, content);
  if (!answerKey) return null;
  return { id, content, answerKey };
}

export function revealAnswer(question: Pick<ServerQuestion, "content" | "answerKey">): RevealedAnswer {
  const { content, answerKey } = question;
  if (answerKey.type === "numeric_response" && content.type === "numeric_response") {
    return { type: "numeric_response", value: answerKey.value, tolerance: answerKey.tolerance, unit: content.unit };
  }
  return answerKey as Exclude<RevealedAnswer, { type: "numeric_response" }>;
}

// ---- submitted-response validation -----------------------------------------

// Checks a response against the SERVER's question. The client chooses neither
// the scoring mode nor the shape: a response whose `type` differs from the
// question's is rejected. Returns a normalised copy (multiple-select indices
// sorted) or null when invalid.
export function validateResponse(
  content: QuestionContent,
  response: unknown,
): SubmittedResponse | null {
  if (!response || typeof response !== "object") return null;
  const r = response as Record<string, unknown>;
  if (r.type !== content.type) return null;
  switch (content.type) {
    case "single_choice": {
      const index = r.choiceIndex;
      return Number.isInteger(index) && (index as number) >= 0 && (index as number) < content.choices.length
        ? { type: "single_choice", choiceIndex: index as number }
        : null;
    }
    case "multiple_select": {
      const indices = r.choiceIndices;
      if (!Array.isArray(indices) || indices.length === 0) return null;
      if (!indices.every((i) => Number.isInteger(i) && i >= 0 && i < content.choices.length)) return null;
      if (new Set(indices).size !== indices.length) return null;
      return { type: "multiple_select", choiceIndices: [...(indices as number[])].sort((a, b) => a - b) };
    }
    case "true_false_set": {
      const values = r.values;
      return Array.isArray(values) &&
        values.length === content.statements.length &&
        values.every((v) => typeof v === "boolean")
        ? { type: "true_false_set", values: [...(values as boolean[])] }
        : null;
    }
    case "numeric_response":
      return isFiniteNumber(r.value) ? { type: "numeric_response", value: r.value } : null;
  }
}

// Parses what a student typed into a numeric field. Accepts "." or "," as the
// decimal mark (Indonesian users type "2,35"), a Unicode minus sign and
// scientific notation; rejects empty text, thousands separators, NaN/Infinity,
// hex and anything else. Returns null when it is not a finite number.
const NUMERIC_INPUT = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;
export function parseNumericInput(text: string): number | null {
  const cleaned = text.trim().replace(/\u2212/g, "-");
  if (!NUMERIC_INPUT.test(cleaned)) return null;
  const value = Number(cleaned.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

// ---- grading ----------------------------------------------------------------

// |submitted - expected| <= tolerance, exactly as authored — except that the
// comparison allows a few units in the last place of floating-point slack, so
// 2.36 is accepted for 2.35 ± 0.01 even though 2.36 - 2.35 is
// 0.010000000000000231 in binary. The slack (≈1e-15 relative) is far below any
// authorable tolerance.
export function isWithinTolerance(submitted: number, expected: number, tolerance: number): boolean {
  // Purely relative: no absolute floor, so answers of order 1e-19 are not
  // given slack larger than the answer itself.
  const scale = Math.max(Math.abs(submitted), Math.abs(expected));
  return Math.abs(submitted - expected) <= tolerance + 8 * Number.EPSILON * scale;
}

// Pure, total over VALIDATED responses. Callers must run validateResponse
// first; a type mismatch returns false defensively rather than throwing.
export function gradeResponse(answerKey: AnswerKey, response: SubmittedResponse): boolean {
  if (answerKey.type !== response.type) return false;
  switch (answerKey.type) {
    case "single_choice":
      return response.type === "single_choice" && response.choiceIndex === answerKey.correctChoiceIndex;
    case "multiple_select": {
      if (response.type !== "multiple_select") return false;
      const submitted = new Set(response.choiceIndices);
      return (
        submitted.size === answerKey.correctChoiceIndices.length &&
        answerKey.correctChoiceIndices.every((i) => submitted.has(i))
      );
    }
    case "true_false_set":
      return (
        response.type === "true_false_set" &&
        response.values.length === answerKey.truthValues.length &&
        response.values.every((v, i) => v === answerKey.truthValues[i])
      );
    case "numeric_response":
      return (
        response.type === "numeric_response" &&
        isWithinTolerance(response.value, answerKey.value, answerKey.tolerance)
      );
  }
}

// ---- stored-response compatibility -------------------------------------------

// History rows written before this change only have selected_choice_index.
// This is the single place that turns either representation into a response;
// null means "not recorded" (very old rows).
export function storedResponse(row: {
  response?: unknown;
  selectedChoiceIndex?: number | null;
}): SubmittedResponse | null {
  const raw = row.response;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r.type === "single_choice" && Number.isInteger(r.choiceIndex)) return raw as SubmittedResponse;
    if (r.type === "multiple_select" && Array.isArray(r.choiceIndices)) return raw as SubmittedResponse;
    if (r.type === "true_false_set" && Array.isArray(r.values)) return raw as SubmittedResponse;
    if (r.type === "numeric_response" && isFiniteNumber(r.value)) return raw as SubmittedResponse;
  }
  if (typeof row.selectedChoiceIndex === "number") {
    return { type: "single_choice", choiceIndex: row.selectedChoiceIndex };
  }
  return null;
}

// ---- authored question validation (shared by the bank validator) -------------

// Returns problems (empty = fine) for the type-specific structure of one
// authored question. `where` prefixes every message.
export function validateAuthoredShape(
  where: string,
  q:
    | { type: "single_choice" | "multiple_select"; choices: { text: string; correct: boolean }[] }
    | { type: "true_false_set"; statements: { text: string; isTrue: boolean }[] }
    | { type: "numeric_response"; value: number; tolerance: number; unit: string },
): string[] {
  const problems: string[] = [];
  const distinct = (texts: string[]) => new Set(texts.map((t) => t.trim())).size === texts.length;
  switch (q.type) {
    case "single_choice":
    case "multiple_select": {
      const texts = q.choices.map((c) => c.text);
      const correct = q.choices.filter((c) => c.correct).length;
      const min = q.type === "single_choice" ? MIN_CHOICES_SINGLE : MIN_CHOICES_MULTIPLE;
      if (q.choices.length < min) problems.push(`${where}: ${q.type} needs at least ${min} choices`);
      if (texts.some((t) => t.trim() === "")) problems.push(`${where}: empty choice`);
      if (!distinct(texts)) problems.push(`${where}: duplicate choices`);
      if (q.type === "single_choice" && correct !== 1) {
        problems.push(`${where}: exactly one choice must be marked correct (found ${correct})`);
      }
      if (q.type === "multiple_select") {
        if (correct < 2) problems.push(`${where}: multiple_select needs at least two correct choices (found ${correct})`);
        if (correct >= q.choices.length) problems.push(`${where}: multiple_select needs at least one incorrect choice`);
        const banned = /^\s*(all|none) of the (above|these)\s*\.?\s*$/i;
        if (texts.some((t) => banned.test(t))) {
          problems.push(`${where}: do not use "all of the above" / "none of the above"`);
        }
      }
      break;
    }
    case "true_false_set": {
      const texts = q.statements.map((s) => s.text);
      if (q.statements.length < MIN_STATEMENTS || q.statements.length > MAX_STATEMENTS) {
        problems.push(
          `${where}: true_false_set needs ${MIN_STATEMENTS}-${MAX_STATEMENTS} statements (found ${q.statements.length})`,
        );
      }
      if (texts.some((t) => t.trim() === "")) problems.push(`${where}: empty statement`);
      if (!distinct(texts)) problems.push(`${where}: duplicate statements`);
      break;
    }
    case "numeric_response":
      if (!Number.isFinite(q.value)) problems.push(`${where}: numericAnswer.value must be a finite number`);
      if (!Number.isFinite(q.tolerance) || q.tolerance < 0) {
        problems.push(`${where}: numericAnswer.tolerance must be a finite number >= 0`);
      }
      if (q.unit.trim() === "") problems.push(`${where}: numericAnswer.unit must not be empty`);
      break;
  }
  return problems;
}
