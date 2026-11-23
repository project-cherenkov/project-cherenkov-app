import type { QuestionDifficulty, QuestionStatus } from "../planner-vocab";
import type { Subject } from "../subjects";

// One authored multiple-choice question. The files in content/quiz/<subject>/
// (edited in Keystatic, loaded by lib/quiz-bank/load.ts) are the source of
// truth; `pnpm db:seed` (or `pnpm db:seed:quiz`) syncs them into the
// quiz_questions table.
export interface BankQuestion {
  // Stable and unique across the whole bank: "<subject>.<topic>.<difficulty>.<n>".
  // It is the file name and the identity the sync matches on — never reuse a
  // key for a different question, and don't renumber existing ones.
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
  // Archived questions are not served to students but keep their response
  // history. The sync only ever archives: it never restores a question that
  // is archived in the database (see lib/quiz-bank/sync.ts).
  archived: boolean;
  // Optional, git-only notes for editors. Not stored in the database.
  author?: string;
  // Where the question came from (original, adapted from ..., past paper).
  source?: string;
}
