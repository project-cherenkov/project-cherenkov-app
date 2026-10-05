// Phase 3 planner vocabulary — the closed sets of values the planner's
// tables and config share. Pure constants, no imports, so lib/db/schema.ts
// (which drizzle-kit loads directly) and app code can both import it without
// pulling anything else in. If a value is added here, the Postgres enum
// needs a migration (`ALTER TYPE ... ADD VALUE`).

// OSN stages a plan can target. K = kabupaten/kota, P = provinsi. The
// semifinal and final both belong to the national level (dates: see
// lib/osn-stages.ts).
export const OSN_STAGES = ["osn_k", "osn_p", "semifinal", "final"] as const;
export type OsnStage = (typeof OSN_STAGES)[number];

// Difficulty label every quiz question must carry. Three tiers is a starting
// point; a finer scale only needs one more enum value later.
export const QUESTION_DIFFICULTIES = ["basic", "intermediate", "advanced"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

// Review state of a question. Everything generated or unreviewed is `draft`;
// editors flip it to `reviewed`.
export const QUESTION_STATUSES = ["draft", "reviewed"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

// What a plan_item is for (docs: planner context transfer, §4.6).
export const PLAN_ITEM_KINDS = [
  "confirm",
  "study",
  "review",
  "final_review",
  "buffer",
] as const;
export type PlanItemKind = (typeof PLAN_ITEM_KINDS)[number];

// Self-rating scale shown at onboarding. 1 = "barely know it", 5 = "could
// teach it". The prior each value maps to is NOT defined here — that is a
// placeholder that belongs with the (not yet built) mastery estimate.
export const SELF_RATING_MIN = 1;
export const SELF_RATING_MAX = 5;

// Students are in Indonesia (UTC+7); the server clock is UTC, so "today"
// must be computed in the student's own zone.
export const DEFAULT_PLANNER_TIMEZONE = "Asia/Jakarta";

// Sanity bounds on weekly study hours, not a recommendation.
export const MAX_HOURS_PER_WEEK = 80;

// Why a plan item is on the plan, as a stable code. plan_items.reason stores
// one of these; the UI translates it (messages: phase3.planner.reason.*), so
// the wording can change without touching stored rows.
export const PLAN_REASONS = [
  "confirm_high", // rated high, not verified yet: check it is really known
  "confirm_mid", // rated middling, not verified yet
  "confirm_low", // rated low; quizzed last, mostly to calibrate
  "study_weak", // quiz answers say it is not known yet
  "study_uncertain", // quiz answers cannot say yet
  "study_unverified", // self-rating alone puts it below the stage target
  "study_continue", // a later session of a topic too big for one day
  "review_ladder", // spaced revisit, timed against the exam date
  "final_review", // last mixed pass in the days before the exam
] as const;
export type PlanReason = (typeof PLAN_REASONS)[number];

export function isPlanReason(value: string): value is PlanReason {
  return (PLAN_REASONS as readonly string[]).includes(value);
}

// What the planner stores about how a plan was generated, so the plan page can
// say honestly whether the hours were enough without re-running the scheduler.
// A snapshot: it is not updated when settings change; regenerating rewrites it.
export interface PlanSummary {
  subject: string;
  stage: OsnStage;
  examYear: number;
  // First day of the stage window (the day study stops).
  examDate: string;
  hoursPerWeek: number;
  feasible: boolean;
  requiredMinutes: number;
  availableMinutes: number;
  shortfallMinutes: number;
  windowDays: number;
  bufferDays: number;
  // topics.id of topics that lost their confirmation quiz or study time,
  // lowest priority first (the first candidates to cut or defer).
  droppedTopicIds: string[];
  // Mean gap between self-rating and quiz results used for unverified topics
  // (negative = the student tends to overrate). 0 when nothing to learn from.
  calibrationOffset: number;
  // Topics with no quiz question at this stage's difficulty yet, so no
  // confirmation quiz could be planned for them.
  topicsWithoutQuiz: number;
}
