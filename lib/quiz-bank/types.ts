import type { QuestionDifficulty, QuestionStatus } from "../planner-vocab";
import type { AnswerKey, QuestionContent, QuestionType } from "../quiz-types";
import type { Subject } from "../subjects";

// One authored question. The files in content/quiz/<subject>/ (edited in
// Keystatic, loaded by lib/quiz-bank/load.ts) are the source of truth;
// `pnpm db:seed` (or `pnpm db:seed:quiz`) syncs them into the quiz_questions
// table.
//
// A discriminated union on `questionType`: each of the four deterministic
// types carries exactly the fields it needs (docs/engineering/quiz-authoring.md).
export interface BankQuestionBase {
  // Stable and unique across the whole bank: "<subject>.<topic>.<difficulty>.<n>".
  // It is the file name and the identity the sync matches on — never reuse a
  // key for a different question, and don't renumber existing ones. The
  // question type is NOT part of the key.
  key: string;
  subject: Subject;
  // A topic id from lib/syllabus for `subject`.
  topicId: string;
  // REQUIRED on every question: OSN stages draw from different difficulty
  // ranges (lib/osn-stages.ts).
  difficulty: QuestionDifficulty;
  prompt: string;
  explanation: string;
  // `draft` = not yet checked by an editor. Generated questions are always
  // `draft`; only an editor sets `reviewed`.
  status: QuestionStatus;
  // Archived questions are not served to students but keep their response
  // history. The sync only ever archives: it never restores a question that
  // is archived in the database (see lib/quiz-bank/sync.ts).
  archived: boolean;
  // Git-only provenance notes. Required for newly authored questions by the
  // authoring contract, but legacy files have none and are never given an
  // invented author, so the types stay optional. Not stored in the database.
  author?: string;
  source?: string;
  // True when the file had no `questionType` line: a pre-four-types question,
  // read as single_choice. Legacy questions are exempt from the author/source
  // requirement and are written back without a `questionType` line, so a
  // round trip does not rewrite them.
  legacy?: true;
}

export interface SingleChoiceQuestion extends BankQuestionBase {
  questionType: "single_choice";
  choices: string[];
  correctChoiceIndex: number;
}

export interface MultipleSelectQuestion extends BankQuestionBase {
  questionType: "multiple_select";
  choices: string[];
  // Ascending, unique.
  correctChoiceIndices: number[];
}

export interface TrueFalseStatement {
  text: string;
  isTrue: boolean;
}

export interface TrueFalseSetQuestion extends BankQuestionBase {
  questionType: "true_false_set";
  statements: TrueFalseStatement[];
}

export interface NumericAnswerSpec {
  value: number;
  // Absolute tolerance, in `unit`.
  tolerance: number;
  // Shown next to the input; the student does not type it.
  unit: string;
}

export interface NumericResponseQuestion extends BankQuestionBase {
  questionType: "numeric_response";
  numericAnswer: NumericAnswerSpec;
}

export type BankQuestion =
  | SingleChoiceQuestion
  | MultipleSelectQuestion
  | TrueFalseSetQuestion
  | NumericResponseQuestion;

export type { QuestionType };

// The two database representations of a question: public content (may reach
// the browser) and the server-only answer key.
export function splitQuestion(q: BankQuestion): { content: QuestionContent; answerKey: AnswerKey } {
  switch (q.questionType) {
    case "single_choice":
      return {
        content: { type: "single_choice", choices: [...q.choices] },
        answerKey: { type: "single_choice", correctChoiceIndex: q.correctChoiceIndex },
      };
    case "multiple_select":
      return {
        content: { type: "multiple_select", choices: [...q.choices] },
        answerKey: { type: "multiple_select", correctChoiceIndices: [...q.correctChoiceIndices].sort((a, b) => a - b) },
      };
    case "true_false_set":
      return {
        content: { type: "true_false_set", statements: q.statements.map((s) => s.text) },
        answerKey: { type: "true_false_set", truthValues: q.statements.map((s) => s.isTrue) },
      };
    case "numeric_response":
      return {
        content: { type: "numeric_response", unit: q.numericAnswer.unit },
        answerKey: { type: "numeric_response", value: q.numericAnswer.value, tolerance: q.numericAnswer.tolerance },
      };
  }
}

// Inverse of splitQuestion, used when exporting database rows to files.
// Returns null if content and key disagree (a corrupt row).
export function joinQuestionData(
  content: QuestionContent,
  answerKey: AnswerKey,
):
  | Pick<SingleChoiceQuestion, "questionType" | "choices" | "correctChoiceIndex">
  | Pick<MultipleSelectQuestion, "questionType" | "choices" | "correctChoiceIndices">
  | Pick<TrueFalseSetQuestion, "questionType" | "statements">
  | Pick<NumericResponseQuestion, "questionType" | "numericAnswer">
  | null {
  if (content.type !== answerKey.type) return null;
  if (content.type === "single_choice" && answerKey.type === "single_choice") {
    return { questionType: "single_choice", choices: content.choices, correctChoiceIndex: answerKey.correctChoiceIndex };
  }
  if (content.type === "multiple_select" && answerKey.type === "multiple_select") {
    return { questionType: "multiple_select", choices: content.choices, correctChoiceIndices: answerKey.correctChoiceIndices };
  }
  if (content.type === "true_false_set" && answerKey.type === "true_false_set") {
    if (content.statements.length !== answerKey.truthValues.length) return null;
    return {
      questionType: "true_false_set",
      statements: content.statements.map((text, i) => ({ text, isTrue: answerKey.truthValues[i]! })),
    };
  }
  if (content.type === "numeric_response" && answerKey.type === "numeric_response") {
    return {
      questionType: "numeric_response",
      numericAnswer: { value: answerKey.value, tolerance: answerKey.tolerance, unit: content.unit },
    };
  }
  return null;
}
