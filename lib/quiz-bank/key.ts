import { QUESTION_DIFFICULTIES, type QuestionDifficulty } from "../planner-vocab";
import type { Subject } from "../subjects";

// A question's identity is its key: "<subject>.<topic>.<difficulty>.<n>", e.g.
// "physics.vectors.basic.1". In git the key is the file name
// (content/quiz/<subject>/<key>.yaml); in the database it is
// quiz_questions.key, which is what the sync matches on. Keep this module
// tiny and dependency-free: keystatic.config.ts imports it and that file is
// bundled into the browser.

const TOPIC_PART = "[a-z0-9]+(?:-[a-z0-9]+)*";

export function quizKeyPattern(subject: Subject): RegExp {
  return new RegExp(
    `^${subject}\\.${TOPIC_PART}\\.(?:${QUESTION_DIFFICULTIES.join("|")})\\.[1-9][0-9]*$`,
  );
}

export function quizKeyPrefix(
  subject: Subject,
  topicId: string,
  difficulty: QuestionDifficulty,
): string {
  return `${subject}.${topicId}.${difficulty}.`;
}

export function quizKey(
  subject: Subject,
  topicId: string,
  difficulty: QuestionDifficulty,
  n: number,
): string {
  return `${quizKeyPrefix(subject, topicId, difficulty)}${n}`;
}

// Questions created in the old database-only admin page got a random
// "admin.<uuid>" key. They are NOT in git yet (scripts/export-db-quiz-questions.ts
// moves them there and gives them a real key), so the sync leaves them alone.
// Rows with no key at all are older still and are likewise left alone.
export function isGitManagedKey(key: string | null | undefined): key is string {
  return typeof key === "string" && key !== "" && !key.startsWith("admin.");
}
