import { isGitManagedKey } from "@/lib/quiz-bank/key";

// What /keystatic/quiz-bank may still change. Question CONTENT (prompt,
// choices, answer, explanation, topic, difficulty, review status) is edited in
// Keystatic and synced from git, so the database copy is not editable here: an
// edit would be overwritten by the next `pnpm db:seed:quiz` anyway. What stays
// is the emergency switch: archive a bad question instantly (no deploy, no
// sync) and restore it later. See lib/quiz-bank/sync.ts for why only this page
// can restore.

export interface QuizArchivePatch {
  archived: boolean;
}

export function parseQuizArchivePatch(value: unknown):
  | { ok: true; value: QuizArchivePatch }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Request body must be an object." };
  }
  const row = value as Record<string, unknown>;
  if (typeof row.archived !== "boolean") {
    return { ok: false, error: "Archive state must be specified." };
  }
  return { ok: true, value: { archived: row.archived } };
}

// Where a question's content lives. "git" questions are edited in Keystatic;
// "database" ones (admin.* or no key) are not in git yet.
export type QuizQuestionSource = "git" | "database";

export function quizQuestionSource(key: string | null): QuizQuestionSource {
  return isGitManagedKey(key) ? "git" : "database";
}
