import type { Subject } from "../subjects";
import { getPlannerSyllabi, getPlannerTopicIds } from "../syllabus";
import { QUESTION_DIFFICULTIES, type QuestionDifficulty } from "../planner-vocab";
import { quizKeyPattern, quizKeyPrefix } from "./key";
import { isQuestionType, validateAuthoredShape } from "../quiz-types";
import type { BankQuestion } from "./types";

export type { BankQuestion } from "./types";

// The bank itself lives in content/quiz/<subject>/*.yaml and is loaded by
// ./load.ts (server/script side). This module stays free of file access so
// client code and tests can import the validation and coverage helpers.

// Everything that must hold for a question to be safe to seed. Returns the
// problems found (empty = fine) instead of throwing, so a test and the seed
// script can report all of them at once.
export function validateQuizBank(bank: BankQuestion[]): string[] {
  const problems: string[] = [];
  const seenKeys = new Set<string>();

  for (const q of bank) {
    const where = `question "${q.key}"`;

    if (seenKeys.has(q.key)) problems.push(`${where}: duplicate key`);
    seenKeys.add(q.key);

    if (!quizKeyPattern(q.subject).test(q.key)) {
      problems.push(`${where}: key is not of the form <subject>.<topic>.<difficulty>.<number>`);
    }
    const expectedKey = quizKeyPrefix(q.subject, q.topicId, q.difficulty);
    if (!q.key.startsWith(expectedKey)) {
      problems.push(`${where}: key does not match its subject/topic/difficulty (expected prefix "${expectedKey}")`);
    }

    if (!getPlannerTopicIds(q.subject).includes(q.topicId)) {
      problems.push(`${where}: no planner topic "${q.topicId}" in ${q.subject}`);
    }
    if (!(QUESTION_DIFFICULTIES as readonly string[]).includes(q.difficulty)) {
      problems.push(`${where}: missing or unknown difficulty`);
    }
    if (q.prompt.trim() === "") problems.push(`${where}: empty prompt`);
    if (q.explanation.trim() === "") problems.push(`${where}: empty explanation`);
    if (!isQuestionType(q.questionType)) {
      problems.push(`${where}: unknown questionType`);
    } else {
      problems.push(...validateAuthoredShape(where, shapeOf(q)));
    }
    // New-format questions (an explicit questionType in the file) must say who
    // wrote them and where they came from. Legacy files are exempt: their
    // provenance is not invented.
    if (!q.legacy) {
      if (!q.author?.trim()) problems.push(`${where}: author is required`);
      if (!q.source?.trim()) problems.push(`${where}: source is required`);
    }
  }
  return problems;
}

export interface TopicCoverage {
  subject: Subject;
  topicId: string;
  counts: Record<QuestionDifficulty, number>;
}

// How many questions each syllabus topic has per difficulty. A topic with no
// questions at all is still listed (all zeros) — "no questions" must be
// visible, not absent.
// Archived questions are not served, so they do not count.
export function getBankCoverage(bank: BankQuestion[]): TopicCoverage[] {
  const rows: TopicCoverage[] = [];
  for (const syllabus of getPlannerSyllabi()) {
    for (const section of syllabus.sections) {
      for (const topic of section.topics) {
        const counts = { basic: 0, intermediate: 0, advanced: 0 };
        for (const q of bank) {
          if (q.archived) continue;
          if (q.subject === syllabus.subject && q.topicId === topic.id) counts[q.difficulty] += 1;
        }
        rows.push({ subject: syllabus.subject, topicId: topic.id, counts });
      }
    }
  }
  return rows;
}

function shapeOf(q: BankQuestion): Parameters<typeof validateAuthoredShape>[1] {
  switch (q.questionType) {
    case "single_choice":
      return {
        type: "single_choice",
        choices: q.choices.map((text, i) => ({ text, correct: i === q.correctChoiceIndex })),
      };
    case "multiple_select":
      return {
        type: "multiple_select",
        choices: q.choices.map((text, i) => ({ text, correct: q.correctChoiceIndices.includes(i) })),
      };
    case "true_false_set":
      return { type: "true_false_set", statements: q.statements };
    case "numeric_response":
      return { type: "numeric_response", ...q.numericAnswer };
  }
}
