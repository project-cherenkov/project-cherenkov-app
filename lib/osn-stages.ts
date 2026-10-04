// OSN stage config for the Phase 3 planner: official dates, and what each
// stage means for question difficulty. Pure data + pure functions.
//
// Every value here is labelled by where it came from:
//   [USER-PROVIDED]  the project owner supplied it
//   [PROJECTED]      assumed from an earlier year, NOT announced by the organiser
//   [PLACEHOLDER]    made up so the design is concrete — replace before shipping
import {
  DEFAULT_PLANNER_TIMEZONE,
  OSN_STAGES,
  type OsnStage,
  type QuestionDifficulty,
} from "./planner-vocab";

export { OSN_STAGES, type OsnStage } from "./planner-vocab";

export interface StageInfo {
  stage: OsnStage;
  label: { id: string; en: string };
  // [USER-PROVIDED] The owner's stage comparison: OSN-K = "dasar hingga
  // menengah", OSN-P = "menengah hingga lanjutan", national = the hardest,
  // university-level material. The topic list is the same for every stage
  // (the syllabus files carry no per-level marks); only the depth differs, so
  // the stage selects which question difficulties the confirmation quiz draws
  // from (inclusive range, in QUESTION_DIFFICULTIES order).
  //
  // ASSUMPTION: the semifinal has no description in the owner's comparison,
  // so it is treated like the final.
  difficulty: { min: QuestionDifficulty; max: QuestionDifficulty };
  // [PLACEHOLDER] mastery the plan aims for at the stage. The owner has not
  // decided these; they are scheduler inputs, not claims about the exam.
  masteryTarget: number;
}

export const STAGES: Record<OsnStage, StageInfo> = {
  osn_k: {
    stage: "osn_k",
    label: { id: "OSN Kabupaten/Kota (OSN-K)", en: "OSN regency/city (OSN-K)" },
    difficulty: { min: "basic", max: "intermediate" },
    masteryTarget: 0.7,
  },
  osn_p: {
    stage: "osn_p",
    label: { id: "OSN Provinsi (OSN-P)", en: "OSN province (OSN-P)" },
    difficulty: { min: "intermediate", max: "advanced" },
    masteryTarget: 0.8,
  },
  semifinal: {
    stage: "semifinal",
    label: { id: "Semifinal OSN", en: "OSN semifinal" },
    difficulty: { min: "advanced", max: "advanced" },
    masteryTarget: 0.85,
  },
  final: {
    stage: "final",
    label: { id: "Final OSN Nasional", en: "OSN national final" },
    difficulty: { min: "advanced", max: "advanced" },
    masteryTarget: 0.85,
  },
};

export function isOsnStage(value: string): value is OsnStage {
  return (OSN_STAGES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

// Month-day windows, inclusive, as supplied by the owner for 2026. The
// owner's instruction for 2027 is "assume the same schedule", so the same
// month-days are reused for every year listed in SCHEDULE_YEARS. Weekdays
// shift between years; only the calendar dates are carried over.
const BASE_WINDOWS: Record<OsnStage, { start: string; end: string }> = {
  osn_k: { start: "06-18", end: "06-19" },
  osn_p: { start: "07-27", end: "07-29" },
  semifinal: { start: "08-12", end: "08-12" },
  final: { start: "09-14", end: "09-20" },
};

// Years the site knows dates for. When the organiser publishes a different
// 2027 schedule, replace the BASE_WINDOWS assumption for that year with its
// own table and flip the status. Adding a year without announced dates must
// stay "projected".
export const SCHEDULE_YEARS: Record<number, "user-provided" | "projected"> = {
  2026: "user-provided",
  2027: "projected",
};

export interface StageWindow {
  stage: OsnStage;
  year: number;
  start: string; // "YYYY-MM-DD", first day of the stage
  end: string; // "YYYY-MM-DD", last day of the stage
  status: "user-provided" | "projected";
}

export function getStageWindow(
  stage: OsnStage,
  year: number,
): StageWindow | undefined {
  const status = SCHEDULE_YEARS[year];
  if (!status) return undefined;
  const base = BASE_WINDOWS[stage];
  return {
    stage,
    year,
    start: `${year}-${base.start}`,
    end: `${year}-${base.end}`,
    status,
  };
}

// The first scheduled window of `stage` that has not finished yet on `today`
// ("YYYY-MM-DD", in the student's time zone — see todayInTimeZone). Returns
// null when no listed year has an unfinished window left; callers must show
// "dates not published yet" rather than guess.
export function getUpcomingStageWindow(
  stage: OsnStage,
  today: string,
): StageWindow | null {
  const years = Object.keys(SCHEDULE_YEARS)
    .map(Number)
    .sort((a, b) => a - b);
  for (const year of years) {
    const window = getStageWindow(stage, year);
    if (window && window.end >= today) return window;
  }
  return null;
}

// "YYYY-MM-DD" for `now` as seen in `timeZone`. The server clock is UTC, which
// for ~7 hours a day is still "yesterday" in Indonesia — never derive the
// planner's "today" from the server's local date.
export function todayInTimeZone(
  now: Date,
  timeZone: string = DEFAULT_PLANNER_TIMEZONE,
): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}
