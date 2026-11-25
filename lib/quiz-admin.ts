import { isGitManagedKey } from "@/lib/quiz-bank/key";
import { parseAnswerKey, parseQuestionContent } from "@/lib/quiz-types";

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

// One line per item an editor needs to see what a question serves and how it
// is graded, for ANY of the four types. Editor-facing only (the admin API is
// verified-admin gated); a malformed row yields a single warning line instead
// of throwing.
export function summarizeQuestionForAdmin(rawContent: unknown, rawKey: unknown): string[] {
  const content = parseQuestionContent(rawContent);
  const key = content ? parseAnswerKey(rawKey, content) : null;
  if (!content || !key) return ["Malformed content or answer key: this question is not served."];
  switch (content.type) {
    case "single_choice":
      return content.choices.map(
        (choice, i) => `${key.type === "single_choice" && key.correctChoiceIndex === i ? "✓" : "·"} ${choice}`,
      );
    case "multiple_select":
      return content.choices.map(
        (choice, i) => `${key.type === "multiple_select" && key.correctChoiceIndices.includes(i) ? "✓" : "·"} ${choice}`,
      );
    case "true_false_set":
      return content.statements.map(
        (statement, i) =>
          `${key.type === "true_false_set" && key.truthValues[i] ? "True " : "False"} — ${statement}`,
      );
    case "numeric_response":
      return key.type === "numeric_response"
        ? [`${key.value} ${content.unit} (± ${key.tolerance} ${content.unit})`]
        : [];
  }
}
