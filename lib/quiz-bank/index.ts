import type { Subject } from "../subjects";
import { getAllSyllabi, getTopicLocation } from "../syllabus";
import { QUESTION_DIFFICULTIES, type QuestionDifficulty } from "../planner-vocab";
import { astronomyQuestions } from "./astronomy";
import { informaticsQuestions } from "./informatics";
import { physicsQuestions } from "./physics";
import type { BankQuestion } from "./types";

export type { BankEntry, BankQuestion } from "./types";

export const QUIZ_BANK: BankQuestion[] = [
  ...informaticsQuestions,
  ...physicsQuestions,
  ...astronomyQuestions,
];

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

    const expectedKey = `${q.subject}.${q.topicId}.${q.difficulty}.`;
    if (!q.key.startsWith(expectedKey)) {
      problems.push(`${where}: key does not match its subject/topic/difficulty (expected prefix "${expectedKey}")`);
    }

    if (!getTopicLocation(q.subject, q.topicId)) {
      problems.push(`${where}: no syllabus topic "${q.topicId}" in ${q.subject}`);
    }
    if (!(QUESTION_DIFFICULTIES as readonly string[]).includes(q.difficulty)) {
      problems.push(`${where}: missing or unknown difficulty`);
    }
    if (q.prompt.trim() === "") problems.push(`${where}: empty prompt`);
    if (q.explanation.trim() === "") problems.push(`${where}: empty explanation`);
    if (q.choices.length < 2) problems.push(`${where}: needs at least 2 choices`);
    if (new Set(q.choices.map((c) => c.trim())).size !== q.choices.length) {
      problems.push(`${where}: duplicate choices`);
    }
    if (q.choices.some((c) => c.trim() === "")) problems.push(`${where}: empty choice`);
    if (
      !Number.isInteger(q.correctChoiceIndex) ||
      q.correctChoiceIndex < 0 ||
      q.correctChoiceIndex >= q.choices.length
    ) {
      problems.push(`${where}: correctChoiceIndex ${q.correctChoiceIndex} is outside the choices`);
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
export function getBankCoverage(bank: BankQuestion[] = QUIZ_BANK): TopicCoverage[] {
  const rows: TopicCoverage[] = [];
  for (const syllabus of getAllSyllabi()) {
    for (const section of syllabus.sections) {
      for (const topic of section.topics) {
        const counts = { basic: 0, intermediate: 0, advanced: 0 };
        for (const q of bank) {
          if (q.subject === syllabus.subject && q.topicId === topic.id) counts[q.difficulty] += 1;
        }
        rows.push({ subject: syllabus.subject, topicId: topic.id, counts });
      }
    }
  }
  return rows;
}
