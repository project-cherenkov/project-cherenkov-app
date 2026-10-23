// Progress views (R4). Pure functions over plain data: no database, no clock.
// Everything here is private to the student and describes what they actually
// did. Two deliberate exclusions:
//  - opening the app earns nothing: a day counts only when real study (a
//    logged session, or a quiz attempt) happened;
//  - study MINUTES are not mastery, and "understood" marks are the student's
//    own flag. Neither is fed into the mastery estimate; the coverage map
//    shows them side by side with it, never merged.
import { addDays, startOfWeek } from "./plan-dates";
import { todayInTimeZone } from "./osn-stages";
import type { MasteryEstimate, MasteryStatus } from "./mastery";
import type { SubjectSyllabus } from "./syllabus";

// A day counts as active with at least this much logged study in total...
export const ACTIVE_DAY_MIN_MINUTES = 10;
// ...or any quiz attempt.

export interface SessionLike {
  subject: string | null;
  syllabusTopicId: string | null;
  startedAt: Date;
  durationSeconds: number;
}

// "YYYY-MM-DD" of an instant in the student's own zone.
export const dayKey = (at: Date, timeZone: string): string => todayInTimeZone(at, timeZone);

export interface DayActivity {
  date: string;
  minutes: number;
  hadQuizAttempt: boolean;
  active: boolean;
}

export interface WeeklyActivity {
  weekStart: string; // Monday
  days: DayActivity[]; // Monday..Sunday
  activeDays: number;
  totalMinutes: number;
}

export function weeklyActivity(
  today: string,
  sessions: SessionLike[],
  attemptTimes: Date[],
  timeZone: string,
): WeeklyActivity {
  const weekStart = startOfWeek(today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const minutesByDate = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(s.startedAt, timeZone);
    minutesByDate.set(key, (minutesByDate.get(key) ?? 0) + s.durationSeconds / 60);
  }
  const attemptDates = new Set(attemptTimes.map((at) => dayKey(at, timeZone)));

  const days = dates.map((date): DayActivity => {
    const minutes = Math.round(minutesByDate.get(date) ?? 0);
    const hadQuizAttempt = attemptDates.has(date);
    return {
      date,
      minutes,
      hadQuizAttempt,
      active: minutes >= ACTIVE_DAY_MIN_MINUTES || hadQuizAttempt,
    };
  });
  return {
    weekStart,
    days,
    activeDays: days.filter((d) => d.active).length,
    totalMinutes: days.reduce((sum, d) => sum + d.minutes, 0),
  };
}

export interface DayMinutes {
  date: string;
  minutes: number;
}

// The last `days` calendar days ending on `today`, zero-filled.
export function minutesByDay(
  today: string,
  sessions: SessionLike[],
  timeZone: string,
  days = 14,
): DayMinutes[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(s.startedAt, timeZone);
    totals.set(key, (totals.get(key) ?? 0) + s.durationSeconds / 60);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return { date, minutes: Math.round(totals.get(date) ?? 0) };
  });
}

export interface TopicMinutes {
  subject: string | null;
  syllabusTopicId: string | null;
  minutes: number;
}

// Minutes per (subject, topic), largest first; sessions with no topic are
// pooled into one row with null ids. `limit` keeps the long tail out.
export function minutesByTopic(sessions: SessionLike[], limit = 8): TopicMinutes[] {
  const totals = new Map<string, TopicMinutes>();
  for (const s of sessions) {
    const subject = s.syllabusTopicId ? s.subject : null;
    const topicId = s.syllabusTopicId ?? null;
    const key = `${subject ?? ""}/${topicId ?? ""}`;
    const row = totals.get(key) ?? { subject, syllabusTopicId: topicId, minutes: 0 };
    row.minutes += s.durationSeconds / 60;
    totals.set(key, row);
  }
  return [...totals.values()]
    .map((row) => ({ ...row, minutes: Math.round(row.minutes) }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || `${a.syllabusTopicId}`.localeCompare(`${b.syllabusTopicId}`))
    .slice(0, limit);
}

// --- Coverage map ------------------------------------------------------------

export interface CoverageCell {
  topicId: string; // syllabus topic id
  status: MasteryStatus;
  // Posterior bounds and answer count: how much to trust the colour. For an
  // "unverified" topic there is no measurement, so these are not shown.
  answerCount: number;
  pLower: number | null;
  pUpper: number | null;
  pHat: number | null;
  materialSlug: string | null;
  understood: boolean;
}

export interface CoverageSection {
  sectionId: string;
  cells: CoverageCell[];
}

export interface Coverage {
  sections: CoverageSection[];
  counts: Record<MasteryStatus, number>;
  understoodCount: number;
  topicCount: number;
}

// `estimates` is keyed by SYLLABUS topic id. A topic with no estimate (no
// planner row yet) is shown as "unverified" — i.e. "not enough data".
// `understoodMaterials` holds the slugs the student marked as understood.
export function buildCoverage(
  syllabus: SubjectSyllabus,
  estimates: Map<string, MasteryEstimate>,
  materialSlugByTopic: Map<string, string>,
  understoodMaterials: Set<string>,
): Coverage {
  const counts: Record<MasteryStatus, number> = {
    unverified: 0,
    known: 0,
    uncertain: 0,
    not_known: 0,
  };
  let understoodCount = 0;
  let topicCount = 0;

  const sections = syllabus.sections
    .filter((section) => section.topics.length > 0)
    .map((section): CoverageSection => ({
      sectionId: section.id,
      cells: section.topics.map((topic): CoverageCell => {
        const estimate = estimates.get(topic.id);
        const status: MasteryStatus = estimate?.status ?? "unverified";
        const measured = estimate !== undefined && status !== "unverified";
        const materialSlug = materialSlugByTopic.get(topic.id) ?? null;
        const understood = materialSlug !== null && understoodMaterials.has(materialSlug);
        counts[status] += 1;
        topicCount += 1;
        if (understood) understoodCount += 1;
        return {
          topicId: topic.id,
          status,
          answerCount: estimate?.answerCount ?? 0,
          pLower: measured ? estimate.pLower : null,
          pUpper: measured ? estimate.pUpper : null,
          pHat: measured ? estimate.pHat : null,
          materialSlug,
          understood,
        };
      }),
    }));

  return { sections, counts, understoodCount, topicCount };
}
