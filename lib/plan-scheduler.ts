// Phase 3 study-plan scheduler (context-transfer doc, Steps D-G). Pure and
// deterministic: no database, no clock, no randomness. The same input always
// gives the same plan, and every sort has a tie-break, so tests can compare
// plans exactly.
//
// What it composes (all from the research in the context-transfer doc):
//   * Region of Proximal Learning: study time goes to topics ranked by
//     "gain per hour", which favours medium-weak topics over hopeless ones.
//   * Exam-anchored spaced reviews: a topic touched with R days left comes
//     back after a gap that is a fraction of R, until the buffer begins.
//   * A buffer before the exam with one mixed final pass per topic.
//   * Interleaving: inside a day, no more than two consecutive blocks from
//     the same syllabus section.
//   * Honesty about capacity: nothing is silently squeezed. Quizzes and study
//     sessions that do not fit are dropped lowest-priority first and reported
//     (`feasible: false`, `shortfallMinutes`, `droppedTopicKeys`). Reviews are
//     optional extras: they fill spare time, and the ones that do not fit are
//     only counted (`skippedReviewCount`).
//
// EVERY number in SCHEDULER_PARAMS is a [PLACEHOLDER]: chosen so the design is
// concrete, never calibrated on real students. Replace or confirm before
// presenting any of it as validated.
import type { MasteryEstimate } from "./mastery";
import { addDays, daysBetween } from "./plan-dates";
import type { PlanItemKind, PlanReason } from "./planner-vocab";

export const SCHEDULER_PARAMS = {
  // [PLACEHOLDER] Days kept free of new material before the exam (capped at a
  // quarter of the window, so short windows still get study days).
  bufferDays: 7,
  // [PLACEHOLDER] Time for one confirmation quiz on a topic.
  confirmMinutes: 10,
  // [PLACEHOLDER] First-pass study time by the syllabus `effort` field
  // (1 light, 2 medium, 3 heavy). Effort is NOT authored for any topic yet,
  // so every topic currently counts as 2.
  studyMinutesByEffort: { 1: 30, 2: 60, 3: 90 } as Record<number, number>,
  // [PLACEHOLDER] A review costs this fraction of the first-pass study time...
  reviewFraction: 0.4,
  // ...rounded to a multiple of 5 minutes and never below this.
  minReviewMinutes: 10,
  // [PLACEHOLDER] Next review comes after gapFraction * (days left until the
  // buffer starts), clamped to [minGapDays, maxGapDays]. Cepeda et al. (2008)
  // found the best gap is a fraction of the delay to the test; the exact
  // ratio is NOT validated for olympiad problem solving.
  gapFraction: 0.25,
  minGapDays: 2,
  maxGapDays: 21,
  // [PLACEHOLDER] Share of a day's minutes that due reviews may take before
  // new material gets its turn (leftover time still goes to reviews).
  reviewShare: 0.4,
  // [PLACEHOLDER] Weight of "how unsure are we" in a topic's need.
  uncertaintyWeight: 0.25,
  // [PLACEHOLDER] Smallest need a topic flagged for study can have.
  minNeed: 0.05,
  // [PLACEHOLDER] Region of Proximal Learning: a topic whose estimated mastery
  // is at or below learnabilityLow is "not within reach yet" and gets only
  // learnabilityFloor of a full hour's value; from learnabilityHigh upward an
  // hour counts in full (a topic that close to the target has little need
  // left anyway). Linear in between.
  learnabilityFloor: 0.1,
  learnabilityLow: 0.1,
  learnabilityHigh: 0.4,
} as const;

// A topic as the scheduler sees it. `key` is whatever the caller uses to
// identify the topic (the planner passes topics.id).
export interface SchedulerTopic {
  key: string;
  sectionId: string;
  // Syllabus position, used only as a tie-break.
  order: number;
  // 1 light, 2 medium, 3 heavy. Callers resolve a missing value to 2.
  effort: 1 | 2 | 3;
  selfRating: number | null;
  estimate: MasteryEstimate;
  // Whether any quiz question exists for this topic at the chosen stage's
  // difficulty. Without one a confirmation quiz cannot be scheduled.
  canConfirm: boolean;
}

// A completed plan item. Completed items are history: they stay in the plan
// untouched, are never rescheduled, and anchor the topic's review ladder.
export interface FrozenItem {
  topicKey: string;
  kind: PlanItemKind;
  scheduledFor: string; // "YYYY-MM-DD"
}

export interface SchedulerInput {
  topics: SchedulerTopic[];
  today: string; // "YYYY-MM-DD" in the student's time zone
  // First day of the chosen stage's window. Study days end the day before.
  examDate: string;
  hoursPerWeek: number;
  // Stage mastery target (lib/osn-stages.ts), a [PLACEHOLDER] value.
  masteryTarget: number;
  frozen?: FrozenItem[];
}

export interface PlannedItem {
  topicKey: string;
  scheduledFor: string;
  kind: PlanItemKind;
  reason: PlanReason;
  minutes: number;
  // Order within the day, after interleaving (0 first).
  position: number;
}

export type ScheduleProblem = "no_days" | "no_topics";

export interface ScheduleResult {
  feasible: boolean;
  items: PlannedItem[];
  // Minutes of ESSENTIAL work: confirmation quizzes plus first-pass study.
  // Reviews are not counted: they fill whatever time is left over, and a
  // review that does not fit is skipped, not a failure of the plan.
  requiredMinutes: number;
  availableMinutes: number;
  // Minutes of essential work that did not fit. 0 when feasible.
  shortfallMinutes: number;
  // Reviews (spaced or final) that did not fit and were skipped.
  skippedReviewCount: number;
  // Topics that lost their confirmation quiz or study time, lowest priority
  // first: the first ones to cut or defer.
  droppedTopicKeys: string[];
  droppedItemCount: number;
  dailyMinutes: number;
  windowDays: number; // study days from today up to the day before the exam
  bufferDays: number;
  problem?: ScheduleProblem;
}

interface Pending {
  seq: number;
  topicKey: string;
  sectionId: string;
  kind: PlanItemKind;
  reason: PlanReason;
  minutes: number;
  // Lowest day this item may be placed on.
  earliest: number;
  // Priority for new material: lower sorts first.
  group: number;
  gain: number;
  order: number;
  need: number;
  // Study sessions of one topic are placed on different days, in sequence.
  after: Pending | null;
  isLastStudySession: boolean;
  placedDay: number | null;
}

interface TopicPlan {
  topic: SchedulerTopic;
  needsStudy: boolean;
  needsConfirm: boolean;
  need: number;
  reviewMinutes: number;
}

const roundTo5 = (n: number) => Math.round(n / 5) * 5;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function cmp(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function emptyResult(
  problem: ScheduleProblem,
  windowDays: number,
  dailyMinutes: number,
): ScheduleResult {
  return {
    feasible: false,
    items: [],
    requiredMinutes: 0,
    availableMinutes: Math.max(0, windowDays) * dailyMinutes,
    shortfallMinutes: 0,
    skippedReviewCount: 0,
    droppedTopicKeys: [],
    droppedItemCount: 0,
    dailyMinutes,
    windowDays: Math.max(0, windowDays),
    bufferDays: 0,
    problem,
  };
}

// How much of a full hour's value an hour on this topic is worth, given the
// current best guess of its mastery. Low for topics still far out of reach,
// full once they are in the proximal region. (Topics near the target are
// handled by `need` shrinking towards zero, not by this factor.)
function learnability(pHat: number): number {
  const { learnabilityFloor: floor, learnabilityLow: lo, learnabilityHigh: hi } =
    SCHEDULER_PARAMS;
  const rise = clamp((pHat - lo) / (hi - lo), 0, 1);
  return floor + (1 - floor) * rise;
}

function planTopic(topic: SchedulerTopic, input: SchedulerInput, frozen: FrozenItem[]): TopicPlan {
  const { estimate: est } = topic;
  const target = input.masteryTarget;
  const verified = est.status !== "unverified";
  const studyDone = frozen.some((f) => f.kind === "study");
  const confirmDone = frozen.some((f) => f.kind === "confirm");

  const needsStudy =
    !studyDone &&
    (est.status === "not_known" ||
      est.status === "uncertain" ||
      (est.status === "unverified" && est.pHat < target));
  const needsConfirm = est.status === "unverified" && topic.canConfirm && !confirmDone;

  const base = verified ? est.pLower : est.pHat;
  let need = Math.max(0, target - base);
  if (verified) need += SCHEDULER_PARAMS.uncertaintyWeight * (est.pUpper - est.pLower);
  if (needsStudy) need = Math.max(need, SCHEDULER_PARAMS.minNeed);

  const studyMinutes = SCHEDULER_PARAMS.studyMinutesByEffort[topic.effort] ?? 60;
  const reviewMinutes = Math.max(
    SCHEDULER_PARAMS.minReviewMinutes,
    roundTo5(studyMinutes * SCHEDULER_PARAMS.reviewFraction),
  );
  return { topic, needsStudy, needsConfirm, need, reviewMinutes };
}

// Confirmation tier from the self-rating: high-rated topics first (the
// overconfidence risk), middling next, very low last.
function confirmTier(rating: number | null): 0 | 1 | 2 {
  if (rating !== null && rating >= 4) return 0;
  if (rating !== null && rating <= 1) return 2;
  return 1;
}

const CONFIRM_REASON: Record<0 | 1 | 2, PlanReason> = {
  0: "confirm_high",
  1: "confirm_mid",
  2: "confirm_low",
};

// New-material priority groups, lowest first: confirm(high), confirm(mid),
// study, confirm(low).
const GROUP_STUDY = 2;
const GROUP_CONFIRM_LOW = 3;

function compareNew(a: Pending, b: Pending): number {
  return (
    cmp(a.group, b.group) ||
    cmp(b.gain, a.gain) ||
    cmp(a.order, b.order) ||
    a.topicKey.localeCompare(b.topicKey) ||
    cmp(a.seq, b.seq)
  );
}

// Reorders one day's items so no more than two consecutive blocks share a
// syllabus section, where that is possible. Stable and deterministic.
function interleave<T extends { sectionId: string }>(items: T[]): T[] {
  const remaining = [...items];
  const out: T[] = [];
  while (remaining.length > 0) {
    const last = out[out.length - 1];
    const beforeLast = out[out.length - 2];
    const blocked =
      last && beforeLast && last.sectionId === beforeLast.sectionId
        ? last.sectionId
        : null;
    let index = remaining.findIndex((item) => item.sectionId !== blocked);
    if (index === -1) index = 0;
    out.push(remaining.splice(index, 1)[0]!);
  }
  return out;
}

export function scheduleStudyPlan(input: SchedulerInput): ScheduleResult {
  const P = SCHEDULER_PARAMS;
  const dailyMinutes = Math.max(1, Math.round((input.hoursPerWeek * 60) / 7));
  const windowDays = daysBetween(input.today, input.examDate);

  if (windowDays <= 0) return emptyResult("no_days", windowDays, dailyMinutes);
  if (input.topics.length === 0) return emptyResult("no_topics", windowDays, dailyMinutes);

  const bufferDays = Math.min(P.bufferDays, Math.floor(windowDays / 4));
  const mainEnd = windowDays - bufferDays; // first buffer day; new material stops here

  const frozenByTopic = new Map<string, FrozenItem[]>();
  for (const item of input.frozen ?? []) {
    const list = frozenByTopic.get(item.topicKey) ?? [];
    list.push(item);
    frozenByTopic.set(item.topicKey, list);
  }

  const topics = [...input.topics].sort(
    (a, b) => cmp(a.order, b.order) || a.key.localeCompare(b.key),
  );
  const plans = topics.map((t) => planTopic(t, input, frozenByTopic.get(t.key) ?? []));
  const planByKey = new Map(plans.map((p) => [p.topic.key, p]));

  let seq = 0;
  const pool: Pending[] = [];

  const make = (
    plan: TopicPlan,
    fields: Pick<Pending, "kind" | "reason" | "minutes" | "earliest"> &
      Partial<Pending>,
  ): Pending => {
    const item: Pending = {
      seq: seq++,
      topicKey: plan.topic.key,
      sectionId: plan.topic.sectionId,
      group: GROUP_STUDY,
      gain: 0,
      order: plan.topic.order,
      need: plan.need,
      after: null,
      isLastStudySession: false,
      placedDay: null,
      ...fields,
    };
    pool.push(item);
    return item;
  };

  // ---- Step 1: new material -------------------------------------------------
  for (const plan of plans) {
    const { topic } = plan;
    if (plan.needsConfirm) {
      const tier = confirmTier(topic.selfRating);
      make(plan, {
        kind: "confirm",
        reason: CONFIRM_REASON[tier],
        minutes: Math.min(P.confirmMinutes, dailyMinutes),
        earliest: 0,
        group: tier === 2 ? GROUP_CONFIRM_LOW : tier,
      });
    }
    if (plan.needsStudy) {
      const total = P.studyMinutesByEffort[topic.effort] ?? 60;
      const size = Math.min(total, dailyMinutes);
      const sessions = Math.ceil(total / size);
      const gain = (plan.need * learnability(topic.estimate.pHat)) / (total / 60);
      const status = topic.estimate.status;
      const firstReason: PlanReason =
        status === "not_known"
          ? "study_weak"
          : status === "uncertain"
            ? "study_uncertain"
            : "study_unverified";
      let previous: Pending | null = null;
      for (let s = 0; s < sessions; s++) {
        const minutes = s === sessions - 1 ? total - size * (sessions - 1) : size;
        previous = make(plan, {
          kind: "study",
          reason: s === 0 ? firstReason : "study_continue",
          minutes,
          earliest: 0,
          gain,
          after: previous,
          isLastStudySession: s === sessions - 1,
        });
      }
    }
  }

  // ---- Step 2: day-by-day placement -----------------------------------------
  const placed: { item: Pending; day: number }[] = [];

  // Review ladder: with R days left before the buffer, the next review is a
  // fraction of R away; it stops once the buffer would start.
  const releaseLadder = (plan: TopicPlan, anchorDay: number) => {
    const remainingDays = mainEnd - anchorDay;
    const gap = clamp(
      Math.round(P.gapFraction * remainingDays),
      P.minGapDays,
      P.maxGapDays,
    );
    const due = anchorDay + gap;
    if (due >= mainEnd) return;
    make(plan, {
      kind: "review",
      reason: "review_ladder",
      minutes: Math.min(plan.reviewMinutes, dailyMinutes),
      earliest: due,
    });
  };

  // Topics that need neither a confirmation nor study start their ladder
  // straight away, anchored at their last completed touch (or yesterday).
  for (const plan of plans) {
    if (plan.needsConfirm || plan.needsStudy) continue;
    const touches = (frozenByTopic.get(plan.topic.key) ?? []).map((f) =>
      daysBetween(input.today, f.scheduledFor),
    );
    const anchor = touches.length > 0 ? Math.min(-1, Math.max(...touches)) : -1;
    releaseLadder(plan, anchor);
  }

  // One mixed final pass per topic in the buffer, most needy first.
  if (bufferDays > 0) {
    for (const plan of [...plans].sort(
      (a, b) => cmp(b.need, a.need) || cmp(a.topic.order, b.topic.order) || a.topic.key.localeCompare(b.topic.key),
    )) {
      make(plan, {
        kind: "final_review",
        reason: "final_review",
        minutes: Math.min(plan.reviewMinutes, dailyMinutes),
        earliest: mainEnd,
      });
    }
  }

  const isReview = (item: Pending) => item.kind === "review" || item.kind === "final_review";
  const compareReviews = (a: Pending, b: Pending) =>
    cmp(a.earliest, b.earliest) ||
    cmp(b.need, a.need) ||
    cmp(a.order, b.order) ||
    a.topicKey.localeCompare(b.topicKey) ||
    cmp(a.seq, b.seq);

  for (let day = 0; day < windowDays; day++) {
    let remaining = dailyMinutes;
    let reviewMinutesUsed = 0;
    const today: Pending[] = [];

    const place = (item: Pending) => {
      item.placedDay = day;
      remaining -= item.minutes;
      today.push(item);
      placed.push({ item, day });
      const plan = planByKey.get(item.topicKey)!;
      if (item.kind === "review") releaseLadder(plan, day);
      else if (item.kind === "confirm" && !plan.needsStudy) releaseLadder(plan, day);
      else if (item.kind === "study" && item.isLastStudySession) releaseLadder(plan, day);
    };

    const dueReviews = () =>
      pool
        .filter((item) => item.placedDay === null && isReview(item) && item.earliest <= day)
        .sort(compareReviews);

    // (a) due reviews, up to their share of the day
    for (const item of dueReviews()) {
      if (
        item.minutes <= remaining &&
        reviewMinutesUsed + item.minutes <= P.reviewShare * dailyMinutes
      ) {
        place(item);
        reviewMinutesUsed += item.minutes;
      }
    }

    // (b) new material, in priority order (not once the buffer has begun)
    if (day < mainEnd) {
      const eligible = pool
        .filter(
          (item) =>
            item.placedDay === null &&
            !isReview(item) &&
            (item.after === null ||
              (item.after.placedDay !== null && item.after.placedDay < day)),
        )
        .sort(compareNew);
      for (const item of eligible) {
        if (remaining <= 0) break;
        if (item.minutes <= remaining) place(item);
      }
    }

    // (c) leftover time goes to whatever reviews are still due
    for (const item of dueReviews()) {
      if (remaining <= 0) break;
      if (item.minutes <= remaining) place(item);
    }
  }

  // ---- Step 3: interleave within each day -----------------------------------
  const byDay = new Map<number, Pending[]>();
  for (const { item, day } of placed) {
    const list = byDay.get(day) ?? [];
    list.push(item);
    byDay.set(day, list);
  }
  const items: PlannedItem[] = [];
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    interleave(byDay.get(day)!).forEach((item, position) => {
      items.push({
        topicKey: item.topicKey,
        scheduledFor: addDays(input.today, day),
        kind: item.kind,
        reason: item.reason,
        minutes: item.minutes,
        position,
      });
    });
  }

  // ---- Step 4: report what did not fit --------------------------------------
  // Feasible means every confirmation quiz and study session found a slot.
  // Skipped reviews are reported but do not make a plan infeasible.
  const dropped = pool.filter((item) => item.placedDay === null);
  const droppedNew = dropped
    .filter((item) => !isReview(item))
    .sort((a, b) => compareNew(b, a)); // lowest priority first
  const droppedTopicKeys = [...new Set(droppedNew.map((item) => item.topicKey))];
  const essentialMinutes = pool
    .filter((item) => !isReview(item))
    .reduce((sum, item) => sum + item.minutes, 0);

  return {
    feasible: droppedNew.length === 0,
    items,
    requiredMinutes: essentialMinutes,
    availableMinutes: windowDays * dailyMinutes,
    shortfallMinutes: droppedNew.reduce((sum, item) => sum + item.minutes, 0),
    skippedReviewCount: dropped.length - droppedNew.length,
    droppedTopicKeys,
    droppedItemCount: droppedNew.length,
    dailyMinutes,
    windowDays,
    bufferDays,
  };
}
