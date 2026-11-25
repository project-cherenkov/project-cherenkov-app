// Synthetic fixtures for the quiz-bank tests, one per question type. They are
// test data (placeholder text, an existing physics topic), NOT authored
// questions, and nothing outside tests may import this file.
import type {
  BankQuestion,
  MultipleSelectQuestion,
  NumericResponseQuestion,
  SingleChoiceQuestion,
  TrueFalseSetQuestion,
} from "./types";

const base = {
  subject: "physics" as const,
  topicId: "vectors",
  difficulty: "basic" as const,
  prompt: "Prompt",
  explanation: "Because",
  status: "draft" as const,
  archived: false,
  author: "Test author",
  source: "original",
};

export const SINGLE: SingleChoiceQuestion = {
  ...base,
  key: "physics.vectors.basic.1",
  questionType: "single_choice",
  choices: ["a", "b", "c"],
  correctChoiceIndex: 2,
};

export const MULTIPLE: MultipleSelectQuestion = {
  ...base,
  key: "physics.vectors.basic.2",
  questionType: "multiple_select",
  choices: ["a", "b", "c", "d", "e"],
  correctChoiceIndices: [0, 2],
};

export const TRUE_FALSE: TrueFalseSetQuestion = {
  ...base,
  key: "physics.vectors.basic.3",
  questionType: "true_false_set",
  statements: [
    { text: "s1", isTrue: true },
    { text: "s2", isTrue: false },
    { text: "s3", isTrue: true },
    { text: "s4", isTrue: false },
  ],
};

export const NUMERIC: NumericResponseQuestion = {
  ...base,
  key: "physics.vectors.basic.4",
  questionType: "numeric_response",
  numericAnswer: { value: 2.35, tolerance: 0.01, unit: "au" },
};

export const ALL_TYPES: BankQuestion[] = [SINGLE, MULTIPLE, TRUE_FALSE, NUMERIC];
