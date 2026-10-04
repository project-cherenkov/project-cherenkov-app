import type { QuestionDifficulty, QuestionStatus } from "../planner-vocab";
import type { Subject } from "../subjects";

// One authored multiple-choice question. The bank in lib/quiz-bank is the
// source of truth, in the same way lib/syllabus is; `pnpm db:seed` copies it
// into the quiz_questions table.
export interface BankQuestion {
  // Stable and unique across the whole bank: "<subject>.<topic>.<difficulty>.<n>".
  // It is the identity the seed upserts on — never reuse a key for a
  // different question, and don't renumber existing ones.
  key: string;
  subject: Subject;
  // A topic id from lib/syllabus for `subject`.
  topicId: string;
  // REQUIRED on every question: OSN stages draw from different difficulty
  // ranges (lib/osn-stages.ts).
  difficulty: QuestionDifficulty;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
  // `draft` = not yet checked by an editor. Generated questions are always
  // `draft`; only an editor sets `reviewed`.
  status: QuestionStatus;
}

// Short authoring shape used by the data files.
export interface BankEntry {
  topic: string;
  d: QuestionDifficulty;
  // Disambiguates several questions on the same topic and difficulty.
  n?: number;
  q: string;
  c: string[];
  // Index into `c` of the single correct choice.
  a: number;
  why: string;
  // Defaults to "draft".
  status?: QuestionStatus;
}
