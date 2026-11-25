import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../keystatic.config";
import { SUBJECTS, type Subject } from "../subjects";
import { parseQuizFile, quizFilePath, type QuizFileData } from "./files";
import type { BankQuestion } from "./types";

// The three Keystatic collections that hold quiz questions, one per subject
// (same per-subject pattern as editorials and materials, so a question can
// never sit in the wrong subject's folder).
export const QUIZ_COLLECTIONS = {
  informatics: "informaticsQuestions",
  physics: "physicsQuestions",
  astronomy: "astronomyQuestions",
} as const satisfies Record<Subject, string>;

export interface LoadedQuizBank {
  bank: BankQuestion[];
  // Per-file problems (no single correct choice, ID not matching the file
  // name, ...). Empty means every file produced a question.
  problems: string[];
}

// Reads every content/quiz/<subject>/*.yaml through Keystatic's own reader, so
// what the sync sees is exactly what the editor saved. Server/script side only.
export async function loadQuizBank(root = process.cwd()): Promise<LoadedQuizBank> {
  const reader = createReader(root, keystaticConfig);
  const bank: BankQuestion[] = [];
  const problems: string[] = [];

  for (const subject of SUBJECTS) {
    const collection = reader.collections[QUIZ_COLLECTIONS[subject]];
    const keys = (await collection.list()).sort();
    for (const key of keys) {
      let entry: QuizFileData | null;
      try {
        entry = (await collection.read(key)) as QuizFileData | null;
      } catch (error) {
        problems.push(
          `content/quiz/${subject}/${key}.yaml: could not be read (${error instanceof Error ? error.message : String(error)})`,
        );
        continue;
      }
      if (!entry) continue;
      // Keystatic's reader fills in a default for a missing `questionType`, so
      // a legacy file (no line at all) looks the same as an explicit
      // single_choice. Whether the line is present decides legacy treatment
      // (author/source exemption, no rewrite), so check the file itself.
      const hasType = await fileDeclaresQuestionType(root, subject, key);
      const parsed = parseQuizFile(subject, key, hasType ? entry : { ...entry, questionType: undefined });
      problems.push(...parsed.problems);
      if (parsed.question) bank.push(parsed.question);
    }
  }
  return { bank, problems };
}

async function fileDeclaresQuestionType(root: string, subject: Subject, key: string): Promise<boolean> {
  try {
    const text = await readFile(join(root, quizFilePath(subject, key)), "utf8");
    return /^questionType:/m.test(text);
  } catch {
    return true; // unreadable here but readable by Keystatic: treat as new-format (stricter)
  }
}
