// Phase 3 planner onboarding data: the student's settings (subject, OSN stage,
// exam year, weekly hours, time zone) and their per-topic self-ratings.
// Pure validation plus dependency-injected cores, in the style of
// lib/quiz-scoring.ts and lib/plan-generator.ts, so they are testable without
// a database. The "use server" entry points live in
// lib/planner-settings-actions.ts — this file must NOT be a "use server"
// module, because every export of one becomes a publicly callable endpoint and
// these cores take a userId.
import {
  getStageWindow,
  isOsnStage,
  isValidTimeZone,
  type OsnStage,
} from "./osn-stages";
import {
  DEFAULT_PLANNER_TIMEZONE,
  MAX_HOURS_PER_WEEK,
  SELF_RATING_MAX,
  SELF_RATING_MIN,
} from "./planner-vocab";
import { isKnownSubject, type Subject } from "./subjects";
import { getTopicCount, getTopicLocation } from "./syllabus";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface PlannerSettings {
  subject: Subject;
  stage: OsnStage;
  examYear: number;
  hoursPerWeek: number; // one decimal at most
  timezone: string;
}

export type SettingsField = "subject" | "stage" | "examYear" | "hoursPerWeek" | "timezone";

export type SettingsValidation =
  | { ok: true; value: PlannerSettings }
  | { ok: false; errors: Partial<Record<SettingsField, string>> };

// `today` is "YYYY-MM-DD" in the student's zone (todayInTimeZone). The input
// is `unknown` on purpose: server actions are network-callable, so TypeScript's
// types say nothing about what actually arrives.
export function validatePlannerSettings(
  input: unknown,
  today: string,
): SettingsValidation {
  const errors: Partial<Record<SettingsField, string>> = {};
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;

  const subject = typeof raw.subject === "string" && isKnownSubject(raw.subject) ? raw.subject : null;
  if (!subject) errors.subject = "Choose informatics, physics or astronomy.";

  const stage = typeof raw.stage === "string" && isOsnStage(raw.stage) ? raw.stage : null;
  if (!stage) errors.stage = "Choose an OSN stage.";

  let examYear: number | null = null;
  if (typeof raw.examYear !== "number" || !Number.isInteger(raw.examYear)) {
    errors.examYear = "Exam year must be a whole number.";
  } else if (stage) {
    const window = getStageWindow(stage, raw.examYear);
    if (!window) errors.examYear = "No dates are published for that stage and year.";
    else if (window.end < today) errors.examYear = "That stage has already taken place.";
    else examYear = raw.examYear;
  }

  let hoursPerWeek: number | null = null;
  if (typeof raw.hoursPerWeek !== "number" || !Number.isFinite(raw.hoursPerWeek)) {
    errors.hoursPerWeek = "Weekly hours must be a number.";
  } else {
    const rounded = Math.round(raw.hoursPerWeek * 10) / 10;
    if (rounded <= 0 || rounded > MAX_HOURS_PER_WEEK) {
      errors.hoursPerWeek = `Weekly hours must be more than 0 and at most ${MAX_HOURS_PER_WEEK}.`;
    } else {
      hoursPerWeek = rounded;
    }
  }

  let timezone = DEFAULT_PLANNER_TIMEZONE;
  if (raw.timezone !== undefined) {
    if (typeof raw.timezone === "string" && isValidTimeZone(raw.timezone)) {
      timezone = raw.timezone;
    } else {
      errors.timezone = "Unknown time zone.";
    }
  }

  if (Object.keys(errors).length > 0 || !subject || !stage || examYear === null || hoursPerWeek === null) {
    return { ok: false, errors };
  }
  return { ok: true, value: { subject, stage, examYear, hoursPerWeek, timezone } };
}

export interface SettingsDeps {
  getSettings: (userId: string) => Promise<PlannerSettings | null>;
  upsertSettings: (userId: string, settings: PlannerSettings) => Promise<void>;
}

export type SaveSettingsResult =
  | {
      ok: true;
      // True when the student switched subject. An existing study plan was
      // built for the old subject, so the caller must regenerate it; this
      // function deliberately does not delete anything.
      subjectChanged: boolean;
    }
  | { ok: false; errors: Partial<Record<SettingsField, string>> };

export async function savePlannerSettingsCore(
  deps: SettingsDeps,
  userId: string,
  input: unknown,
  today: string,
): Promise<SaveSettingsResult> {
  const validated = validatePlannerSettings(input, today);
  if (!validated.ok) return validated;

  const previous = await deps.getSettings(userId);
  await deps.upsertSettings(userId, validated.value);
  return {
    ok: true,
    subjectChanged: previous !== null && previous.subject !== validated.value.subject,
  };
}

// ---------------------------------------------------------------------------
// Self-ratings
// ---------------------------------------------------------------------------

export interface SelfRatingInput {
  syllabusTopicId: string;
  rating: number;
}

export type RatingsValidation =
  | { ok: true; value: SelfRatingInput[] }
  | { ok: false; error: string };

// Ratings are for syllabus topics of the student's chosen subject. Strict on
// purpose: one bad entry rejects the whole submission rather than silently
// saving a subset.
export function validateSelfRatings(
  input: unknown,
  subject: Subject,
): RatingsValidation {
  if (!Array.isArray(input)) return { ok: false, error: "Ratings must be a list." };
  if (input.length === 0) return { ok: false, error: "No ratings submitted." };
  if (input.length > getTopicCount(subject)) {
    return { ok: false, error: "More ratings than topics in this subject." };
  }

  const seen = new Set<string>();
  const value: SelfRatingInput[] = [];
  for (const entry of input) {
    const item = (typeof entry === "object" && entry !== null ? entry : {}) as Record<
      string,
      unknown
    >;
    const id = item.syllabusTopicId;
    if (typeof id !== "string" || !getTopicLocation(subject, id)) {
      return { ok: false, error: `Unknown topic: ${String(id)}` };
    }
    if (seen.has(id)) return { ok: false, error: `Topic rated twice: ${id}` };
    seen.add(id);

    const rating = item.rating;
    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < SELF_RATING_MIN ||
      rating > SELF_RATING_MAX
    ) {
      return {
        ok: false,
        error: `Rating for ${id} must be a whole number from ${SELF_RATING_MIN} to ${SELF_RATING_MAX}.`,
      };
    }
    value.push({ syllabusTopicId: id, rating });
  }
  return { ok: true, value };
}

export interface RatingRow {
  topicId: string; // topics.id (uuid)
  rating: number;
}

export interface SelfRatingDeps {
  getSettings: (userId: string) => Promise<PlannerSettings | null>;
  // Maps syllabus topic ids of `subject` to topics.id; ids with no topics row
  // are simply absent from the map.
  getTopicRowIds: (
    subject: Subject,
    syllabusTopicIds: string[],
  ) => Promise<Map<string, string>>;
  upsertRatings: (userId: string, rows: RatingRow[]) => Promise<void>;
}

export type SaveRatingsResult =
  | { ok: true; saved: number }
  | { ok: false; reason: "no_settings" | "invalid" | "topics_not_seeded"; message?: string };

// Saves the latest rating per (user, topic); there is no history.
export async function saveSelfRatingsCore(
  deps: SelfRatingDeps,
  userId: string,
  input: unknown,
): Promise<SaveRatingsResult> {
  const settings = await deps.getSettings(userId);
  if (!settings) return { ok: false, reason: "no_settings" };

  const validated = validateSelfRatings(input, settings.subject);
  if (!validated.ok) return { ok: false, reason: "invalid", message: validated.error };

  const ids = await deps.getTopicRowIds(
    settings.subject,
    validated.value.map((r) => r.syllabusTopicId),
  );
  const rows: RatingRow[] = [];
  for (const r of validated.value) {
    const topicId = ids.get(r.syllabusTopicId);
    if (!topicId) return { ok: false, reason: "topics_not_seeded" };
    rows.push({ topicId, rating: r.rating });
  }

  await deps.upsertRatings(userId, rows);
  return { ok: true, saved: rows.length };
}
