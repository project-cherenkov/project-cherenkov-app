import {
  QUESTION_DIFFICULTIES,
  QUESTION_STATUSES,
  type QuestionDifficulty,
  type QuestionStatus,
} from "@/lib/planner-vocab";

export interface QuizQuestionInput {
  subject: "informatics" | "physics" | "astronomy";
  topicId: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
  difficulty: QuestionDifficulty;
}

export interface QuizQuestionPatch extends QuizQuestionInput {
  status: QuestionStatus;
  archived: boolean;
}

export function parseQuizQuestionInput(value: unknown):
  | { ok: true; value: QuizQuestionInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Question data must be an object." };
  }
  const row = value as Record<string, unknown>;
  if (!["informatics", "physics", "astronomy"].includes(String(row.subject))) {
    return { ok: false, error: "Choose a valid subject." };
  }
  if (typeof row.topicId !== "string" || !row.topicId) return { ok: false, error: "Choose a topic." };
  if (typeof row.prompt !== "string" || !row.prompt.trim()) return { ok: false, error: "Prompt is required." };
  if (row.prompt.length > 20000) return { ok: false, error: "Prompt must be 20,000 characters or fewer." };
  if (!Array.isArray(row.choices) || row.choices.length < 2) return { ok: false, error: "Add at least two answer choices." };
  if (row.choices.some((choice) => typeof choice !== "string" || !choice.trim())) {
    return { ok: false, error: "Every answer choice must contain text." };
  }
  const choices = row.choices.map((choice) => (choice as string).trim());
  if (new Set(choices).size !== choices.length) return { ok: false, error: "Answer choices must be unique." };
  if (!Number.isInteger(row.correctChoiceIndex) || (row.correctChoiceIndex as number) < 0 || (row.correctChoiceIndex as number) >= choices.length) {
    return { ok: false, error: "Select one of the answer choices as correct." };
  }
  if (typeof row.explanation !== "string" || !row.explanation.trim()) return { ok: false, error: "Explanation is required." };
  if (!(QUESTION_DIFFICULTIES as readonly unknown[]).includes(row.difficulty)) return { ok: false, error: "Choose a valid difficulty." };
  return { ok: true, value: {
    subject: row.subject as QuizQuestionInput["subject"], topicId: row.topicId,
    prompt: row.prompt.trim(), choices, correctChoiceIndex: row.correctChoiceIndex as number,
    explanation: row.explanation.trim(), difficulty: row.difficulty as QuestionDifficulty,
  } };
}

export function parseQuizQuestionPatch(value: unknown):
  | { ok: true; value: QuizQuestionPatch }
  | { ok: false; error: string } {
  const parsed = parseQuizQuestionInput(value);
  if (!parsed.ok) return parsed;
  const row = value as Record<string, unknown>;
  if (!(QUESTION_STATUSES as readonly unknown[]).includes(row.status)) return { ok: false, error: "Choose a valid review status." };
  if (typeof row.archived !== "boolean") return { ok: false, error: "Archive state must be specified." };
  return { ok: true, value: { ...parsed.value, status: row.status as QuestionStatus, archived: row.archived } };
}
