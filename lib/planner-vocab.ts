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
