// View model for the /planner page: turns the stored plan plus the student's
// current mastery estimate into plain data the page can render. Pure apart
// from the injected reads, so it is testable without a database
// (real reads: lib/plan-db.ts).
import type { MasteryStatus } from "./mastery";
import { daysBetween, startOfWeek } from "./plan-dates";
import { loadPlanningState, type PlanReadDeps, type PlanningState } from "./plan-state";
import type { StageWindow } from "./osn-stages";
import type { PlannerSettings } from "./planner-settings";
import {
  isPlanReason,
  type PlanItemKind,
  type PlanReason,
  type PlanSummary,
} from "./planner-vocab";
import { getTopicLocation, localize } from "./syllabus";

export interface StoredPlan {
  id: string;
  generatedAt: Date;
  targetExamDate: string;
  summary: PlanSummary | null;
}

export interface StoredPlanItem {
  id: string;
  topicId: string;
  scheduledFor: string;
  kind: PlanItemKind;
  reason: string | null;
  minutes: number | null;
  position: number;
  completedAt: Date | null;
}

export interface PlanViewDeps extends PlanReadDeps {
  getPlan: (userId: string) => Promise<StoredPlan | null>;
  // Items of topics that belong to the student's current subject and have a
  // syllabus key (Phase 2 leftovers are excluded).
  getPlanItems: (planId: string, topicIds: string[]) => Promise<StoredPlanItem[]>;
  getLatestAttemptAt: (userId: string, topicIds: string[]) => Promise<Date | null>;
}

export interface TopicView {
  topicId: string;
  title: string;
  sectionId: string;
  sectionName: string;
  selfRating: number | null;
  status: MasteryStatus;
  // Posterior mean, 0..1. For an unverified topic this is a guess from the
  // self-rating, not a measurement.
  pHat: number;
  answerCount: number;
  canConfirm: boolean;
  syllabusTopicId: string;
}

export interface ItemView {
  id: string;
  topicId: string;
  title: string;
  sectionName: string;
  kind: PlanItemKind;
  reason: PlanReason | null;
  minutes: number | null;
  scheduledFor: string;
  position: number;
  done: boolean;
}

export interface StageDates {
  start: string;
  end: string;
  status: StageWindow["status"];
}

export type PlannerPageData =
  | { state: "needs_settings"; today: string }
  | {
      state: "needs_plan";
      settings: PlannerSettings;
      today: string;
      stageDates: StageDates | null;
      topics: TopicView[];
      ratedCount: number;
      topicsMissing: boolean; // `pnpm db:seed` has not been run for this subject
    }
  | {
      state: "plan";
      settings: PlannerSettings;
      today: string;
      stageDates: StageDates | null;
      daysLeft: number;
      generatedAt: Date;
      summary: PlanSummary;
      // True when quiz answers were recorded after the plan was generated.
      staleSinceQuiz: boolean;
      // True when subject, stage, year or weekly hours differ from the ones
      // the plan was generated with.
      settingsChanged: boolean;
      topics: TopicView[];
      ratedCount: number;
      items: ItemView[];
      masteryCounts: Record<MasteryStatus, number>;
    };

function toTopicViews(state: PlanningState, locale: string): TopicView[] {
  return state.topics.map((t): TopicView => {
    const located = getTopicLocation(state.settings.subject, t.row.syllabusTopicId);
    return {
      topicId: t.row.id,
      syllabusTopicId: t.row.syllabusTopicId,
      title: located ? localize(located.topic.name, locale) : t.row.syllabusTopicId,
      sectionId: t.sectionId,
      sectionName: located ? localize(located.section.name, locale) : t.sectionId,
      selfRating: t.selfRating,
      status: t.estimate.status,
      pHat: t.estimate.pHat,
      answerCount: t.estimate.answerCount,
      canConfirm: t.canConfirm,
    };
  });
}

export async function buildPlannerPageData(
  deps: PlanViewDeps,
  userId: string,
  now: Date,
  locale: string,
): Promise<PlannerPageData> {
  const state = await loadPlanningState(deps, userId, now);
  if (!state) {
    // No settings yet. "Today" falls back to UTC, only used for display.
    return { state: "needs_settings", today: now.toISOString().slice(0, 10) };
  }

  const { settings, today, window } = state;
  const stageDates: StageDates | null = window
    ? { start: window.start, end: window.end, status: window.status }
    : null;
  const topics = toTopicViews(state, locale);
  const ratedCount = topics.filter((t) => t.selfRating !== null).length;
  const plan = await deps.getPlan(userId);

  // No plan yet; or a plan from before the adaptive scheduler (no summary);
  // or one built for another subject. All three need the same next step:
  // rate the topics of the current subject, then generate.
  if (!plan || !plan.summary || plan.summary.subject !== settings.subject) {
    return {
      state: "needs_plan",
      settings,
      today,
      stageDates,
      topics,
      ratedCount,
      topicsMissing: topics.length === 0,
    };
  }

  const topicIds = topics.map((t) => t.topicId);
  const [stored, latestAttempt] = await Promise.all([
    deps.getPlanItems(plan.id, topicIds),
    deps.getLatestAttemptAt(userId, topicIds),
  ]);
  const topicById = new Map(topics.map((t) => [t.topicId, t]));

  const items: ItemView[] = stored
    .filter((item) => topicById.has(item.topicId))
    .map((item) => {
      const topic = topicById.get(item.topicId)!;
      return {
        id: item.id,
        topicId: item.topicId,
        title: topic.title,
        sectionName: topic.sectionName,
        kind: item.kind,
        reason: item.reason && isPlanReason(item.reason) ? item.reason : null,
        minutes: item.minutes,
        scheduledFor: item.scheduledFor,
        position: item.position,
        done: item.completedAt !== null,
      };
    })
    .sort(
      (a, b) =>
        a.scheduledFor.localeCompare(b.scheduledFor) ||
        a.position - b.position ||
        a.title.localeCompare(b.title),
    );

  const s = plan.summary;
  const settingsChanged =
    (s.stage !== settings.stage ||
      s.examYear !== settings.examYear ||
      s.hoursPerWeek !== settings.hoursPerWeek);

  const masteryCounts: Record<MasteryStatus, number> = {
    unverified: 0,
    known: 0,
    uncertain: 0,
    not_known: 0,
  };
  for (const t of topics) masteryCounts[t.status]++;

  return {
    state: "plan",
    settings,
    today,
    stageDates,
    daysLeft: window ? Math.max(0, daysBetween(today, window.start)) : 0,
    generatedAt: plan.generatedAt,
    summary: s,
    staleSinceQuiz: latestAttempt !== null && latestAttempt.getTime() > plan.generatedAt.getTime(),
    settingsChanged,
    topics,
    ratedCount,
    items,
    masteryCounts,
  };
}

// ---------------------------------------------------------------------------
// Pure list helpers
// ---------------------------------------------------------------------------

export interface TodayList {
  // Not done and scheduled before today, oldest first.
  overdue: ItemView[];
  // Scheduled for today (done ones included, so ticking one off keeps it
  // visible).
  today: ItemView[];
  // When nothing is left to do today or earlier: the next not-done item(s) on
  // the earliest future day that has any. Empty otherwise. This is the
  // "pull forward" suggestion for a student who finishes early.
  upNext: ItemView[];
}

export function buildTodayList(items: ItemView[], today: string): TodayList {
  const overdue = items.filter((i) => !i.done && i.scheduledFor < today);
  const todays = items.filter((i) => i.scheduledFor === today);
  const nothingLeft = overdue.length === 0 && todays.every((i) => i.done);
  let upNext: ItemView[] = [];
  if (nothingLeft) {
    const future = items.filter((i) => !i.done && i.scheduledFor > today);
    const nextDay = future[0]?.scheduledFor;
    upNext = nextDay ? future.filter((i) => i.scheduledFor === nextDay) : [];
  }
  return { overdue, today: todays, upNext };
}

export interface DayGroup {
  date: string;
  items: ItemView[];
  minutes: number;
}

export interface WeekGroup {
  weekStart: string; // Monday
  days: DayGroup[];
  minutes: number;
  doneCount: number;
  itemCount: number;
}

// Items from `fromDate` onward, grouped by ISO week then day.
export function groupItemsByWeek(items: ItemView[], fromDate: string): WeekGroup[] {
  const weeks = new Map<string, Map<string, ItemView[]>>();
  for (const item of items) {
    if (item.scheduledFor < fromDate) continue;
    const weekStart = startOfWeek(item.scheduledFor);
    const days = weeks.get(weekStart) ?? new Map<string, ItemView[]>();
    days.set(item.scheduledFor, [...(days.get(item.scheduledFor) ?? []), item]);
    weeks.set(weekStart, days);
  }
  return [...weeks.keys()]
    .sort()
    .map((weekStart) => {
      const days: DayGroup[] = [...weeks.get(weekStart)!.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayItems]) => ({
          date,
          items: dayItems,
          minutes: dayItems.reduce((sum, i) => sum + (i.minutes ?? 0), 0),
        }));
      const all = days.flatMap((d) => d.items);
      return {
        weekStart,
        days,
        minutes: days.reduce((sum, d) => sum + d.minutes, 0),
        doneCount: all.filter((i) => i.done).length,
        itemCount: all.length,
      };
    });
}
