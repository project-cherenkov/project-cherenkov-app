import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "./plan-dates";
import { estimateMastery } from "./mastery";
import {
  SCHEDULER_PARAMS,
  scheduleStudyPlan,
  type PlannedItem,
  type SchedulerInput,
  type SchedulerTopic,
} from "./plan-scheduler";

const NOW = new Date("2026-10-04T00:00:00Z");
const TODAY = "2026-10-04";
const TARGET = 0.7;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

interface TopicOpts {
  rating?: number | null;
  correct?: number;
  wrong?: number;
  canConfirm?: boolean;
  section?: string;
  effort?: 1 | 2 | 3;
}

function topic(i: number, opts: TopicOpts = {}): SchedulerTopic {
  const answers = [
    ...Array.from({ length: opts.correct ?? 0 }, () => ({ correct: true, answeredAt: daysAgo(1) })),
    ...Array.from({ length: opts.wrong ?? 0 }, () => ({ correct: false, answeredAt: daysAgo(1) })),
  ];
  const selfRating = opts.rating === undefined ? 3 : opts.rating;
  return {
    key: `t${String(i).padStart(2, "0")}`,
    sectionId: opts.section ?? `s${i % 4}`,
    order: i,
    effort: opts.effort ?? 2,
    selfRating,
    estimate: estimateMastery({ selfRating, answers }, TARGET, NOW),
    canConfirm: opts.canConfirm ?? true,
  };
}

function input(topics: SchedulerTopic[], over: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    topics,
    today: TODAY,
    examDate: addDays(TODAY, 60),
    hoursPerWeek: 10,
    masteryTarget: TARGET,
    frozen: [],
    ...over,
  };
}

const minutesPerDay = (items: PlannedItem[]) => {
  const map = new Map<string, number>();
  for (const it of items) map.set(it.scheduledFor, (map.get(it.scheduledFor) ?? 0) + it.minutes);
  return map;
};

describe("scheduleStudyPlan — edge cases", () => {
  it("reports no_days when the exam is today or in the past", () => {
    for (const examDate of [TODAY, addDays(TODAY, -3)]) {
      const r = scheduleStudyPlan(input([topic(0)], { examDate }));
      expect(r.problem).toBe("no_days");
      expect(r.items).toEqual([]);
      expect(r.feasible).toBe(false);
    }
  });

  it("reports no_topics for an empty topic list", () => {
    expect(scheduleStudyPlan(input([])).problem).toBe("no_topics");
  });

  it("works with a one-day window", () => {
    const r = scheduleStudyPlan(input([topic(0)], { examDate: addDays(TODAY, 1) }));
    expect(r.windowDays).toBe(1);
    expect(r.bufferDays).toBe(0);
    for (const it of r.items) expect(it.scheduledFor).toBe(TODAY);
  });
});

describe("scheduleStudyPlan — invariants", () => {
  const topics = Array.from({ length: 24 }, (_, i) =>
    topic(i, { rating: (i % 5) + 1, correct: i % 7 === 0 ? 4 : 0, wrong: i % 5 === 0 ? 3 : 0, canConfirm: i % 3 !== 0 }),
  );

  it("is deterministic: same input, same plan", () => {
    const a = scheduleStudyPlan(input(topics));
    const b = scheduleStudyPlan(input([...topics].reverse()));
    expect(b).toEqual(a);
  });

  it.each([2, 5, 10, 25])("never exceeds a day's capacity (%s h/week)", (hours) => {
    const r = scheduleStudyPlan(input(topics, { hoursPerWeek: hours }));
    for (const used of minutesPerDay(r.items).values()) {
      expect(used).toBeLessThanOrEqual(r.dailyMinutes);
    }
  });

  it("only uses days from today up to the day before the exam", () => {
    const examDate = addDays(TODAY, 40);
    const r = scheduleStudyPlan(input(topics, { examDate }));
    for (const it of r.items) {
      expect(it.scheduledFor >= TODAY).toBe(true);
      expect(it.scheduledFor < examDate).toBe(true);
    }
  });

  it("numbers positions 0..n-1 inside each day", () => {
    const r = scheduleStudyPlan(input(topics));
    const byDay = new Map<string, number[]>();
    for (const it of r.items) byDay.set(it.scheduledFor, [...(byDay.get(it.scheduledFor) ?? []), it.position]);
    for (const positions of byDay.values()) {
      expect([...positions].sort((a, b) => a - b)).toEqual(positions.map((_, i) => i));
    }
  });

  it("keeps new material out of the buffer and final reviews inside it", () => {
    const r = scheduleStudyPlan(input(topics, { hoursPerWeek: 40 }));
    const bufferStart = addDays(TODAY, r.windowDays - r.bufferDays);
    expect(r.bufferDays).toBe(SCHEDULER_PARAMS.bufferDays);
    for (const it of r.items) {
      if (it.kind === "final_review") expect(it.scheduledFor >= bufferStart).toBe(true);
      if (it.kind === "confirm" || it.kind === "study") expect(it.scheduledFor < bufferStart).toBe(true);
    }
  });

  it("shrinks the buffer on short windows so study days remain", () => {
    const r = scheduleStudyPlan(input(topics, { examDate: addDays(TODAY, 8) }));
    expect(r.bufferDays).toBe(2);
    expect(r.windowDays - r.bufferDays).toBeGreaterThan(0);
  });
});

describe("scheduleStudyPlan — coverage and honesty", () => {
  it("schedules every topic that needs work when there is room", () => {
    const topics = Array.from({ length: 12 }, (_, i) => topic(i, { rating: 2 }));
    const r = scheduleStudyPlan(input(topics, { hoursPerWeek: 40 }));
    expect(r.feasible).toBe(true);
    expect(r.shortfallMinutes).toBe(0);
    for (const t of topics) {
      expect(r.items.some((it) => it.topicKey === t.key && it.kind === "study")).toBe(true);
    }
  });

  it("reports an infeasible plan instead of cramming it", () => {
    const topics = Array.from({ length: 40 }, (_, i) => topic(i, { rating: 2 }));
    const r = scheduleStudyPlan(input(topics, { hoursPerWeek: 2, examDate: addDays(TODAY, 21) }));
    expect(r.feasible).toBe(false);
    expect(r.shortfallMinutes).toBeGreaterThan(0);
    expect(r.droppedItemCount).toBeGreaterThan(0);
    expect(r.droppedTopicKeys.length).toBeGreaterThan(0);
    for (const used of minutesPerDay(r.items).values()) expect(used).toBeLessThanOrEqual(r.dailyMinutes);
  });

  it("cuts topics still out of reach before topics in the proximal region", () => {
    // Region of Proximal Learning: with room for only one, the topic at
    // ~75% (uncertain, close to the target) is worth more per hour than the
    // one at ~19% (not within reach yet), so the latter is listed first as a
    // candidate to cut. This pins the behaviour of the PLACEHOLDER learnability
    // shape, not a validated claim.
    const outOfReach = topic(0, { rating: 3, correct: 0, wrong: 4, canConfirm: false });
    const proximal = topic(1, { rating: 4, correct: 3, wrong: 1, canConfirm: false });
    const r = scheduleStudyPlan({
      topics: [outOfReach, proximal],
      today: TODAY,
      examDate: addDays(TODAY, 2),
      hoursPerWeek: 1.5,
      masteryTarget: 0.9,
    });
    expect(r.feasible).toBe(false);
    expect(r.items.find((it) => it.kind === "study")!.topicKey).toBe(proximal.key);
    expect(r.droppedTopicKeys[0]).toBe(outOfReach.key);
  });

  it("splits a study block bigger than a day into sessions on different days", () => {
    const r = scheduleStudyPlan(
      input([topic(0, { rating: 1, effort: 3, canConfirm: false })], { hoursPerWeek: 3.5 }),
    );
    const sessions = r.items.filter((it) => it.kind === "study");
    expect(sessions.length).toBeGreaterThan(1);
    expect(sessions.reduce((s, it) => s + it.minutes, 0)).toBe(SCHEDULER_PARAMS.studyMinutesByEffort[3]);
    expect(new Set(sessions.map((s) => s.scheduledFor)).size).toBe(sessions.length);
    expect(sessions[0]!.reason).toBe("study_unverified");
    expect(sessions[1]!.reason).toBe("study_continue");
  });
});

describe("scheduleStudyPlan — optional reviews", () => {
  it("does not call a plan infeasible just because some reviews were skipped", () => {
    const topics = Array.from({ length: 40 }, (_, i) => topic(i, { rating: (i % 5) + 1 }));
    const r = scheduleStudyPlan(input(topics, { hoursPerWeek: 12, examDate: addDays(TODAY, 120) }));
    expect(r.skippedReviewCount).toBeGreaterThan(0);
    expect(r.droppedItemCount).toBe(0);
    expect(r.feasible).toBe(true);
    expect(r.shortfallMinutes).toBe(0);
  });
});

describe("scheduleStudyPlan — what gets planned for which topic", () => {
  it("gives a verified-known topic reviews only", () => {
    const known = topic(0, { rating: 4, correct: 12, wrong: 0 });
    expect(known.estimate.status).toBe("known");
    const r = scheduleStudyPlan(input([known], { hoursPerWeek: 20 }));
    const kinds = new Set(r.items.map((it) => it.kind));
    expect(kinds.has("study")).toBe(false);
    expect(kinds.has("confirm")).toBe(false);
    expect(kinds.has("review") || kinds.has("final_review")).toBe(true);
  });

  it("confirms an unverified high rating without studying it", () => {
    const t = topic(0, { rating: 5 }); // prior mean 0.85, above the 0.7 target
    const r = scheduleStudyPlan(input([t], { hoursPerWeek: 20 }));
    expect(r.items.some((it) => it.kind === "confirm" && it.reason === "confirm_high")).toBe(true);
    expect(r.items.some((it) => it.kind === "study")).toBe(false);
  });

  it("skips the confirmation quiz when no question exists", () => {
    const r = scheduleStudyPlan(input([topic(0, { rating: 3, canConfirm: false })], { hoursPerWeek: 20 }));
    expect(r.items.some((it) => it.kind === "confirm")).toBe(false);
    expect(r.items.some((it) => it.kind === "study")).toBe(true);
  });

  it("puts high-rated confirmations before mid-rated ones, and very-low-rated last", () => {
    const topics = [
      topic(0, { rating: 1, section: "a" }),
      topic(1, { rating: 3, section: "b" }),
      topic(2, { rating: 5, section: "c" }),
    ];
    const r = scheduleStudyPlan(input(topics, { hoursPerWeek: 40 }));
    const firstDay = (key: string, kind: string) =>
      r.items.find((it) => it.topicKey === key && it.kind === kind)!.scheduledFor + String(
        r.items.find((it) => it.topicKey === key && it.kind === kind)!.position,
      ).padStart(3, "0");
    expect(firstDay("t02", "confirm") < firstDay("t01", "confirm")).toBe(true);
    expect(firstDay("t01", "confirm") < firstDay("t00", "confirm")).toBe(true);
  });

  it("puts better value-per-hour studies first (medium-weak before near-hopeless)", () => {
    const hopeless = topic(0, { rating: 1, canConfirm: false }); // pHat 0.15
    const middling = topic(1, { rating: 3, canConfirm: false }); // pHat 0.55
    const r = scheduleStudyPlan(input([hopeless, middling], { hoursPerWeek: 4 }));
    const studies = r.items.filter((it) => it.kind === "study");
    expect(studies[0]!.topicKey).toBe(middling.key);
  });
});

describe("scheduleStudyPlan — completed (frozen) history", () => {
  it("does not schedule study again for a topic whose study is already done", () => {
    const t = topic(0, { rating: 2, canConfirm: false });
    const r = scheduleStudyPlan(
      input([t], { frozen: [{ topicKey: t.key, kind: "study", scheduledFor: "2026-10-01" }] }),
    );
    expect(r.items.some((it) => it.kind === "study")).toBe(false);
    // ...but the topic still gets revisited.
    expect(r.items.some((it) => it.kind === "review" || it.kind === "final_review")).toBe(true);
  });

  it("does not schedule a second confirmation quiz", () => {
    const t = topic(0, { rating: 4 });
    const r = scheduleStudyPlan(
      input([t], { frozen: [{ topicKey: t.key, kind: "confirm", scheduledFor: "2026-10-02" }] }),
    );
    expect(r.items.some((it) => it.kind === "confirm")).toBe(false);
  });
});

describe("scheduleStudyPlan — review spacing", () => {
  it("places a topic's regular reviews at least minGapDays apart, before the buffer", () => {
    const t = topic(0, { rating: 5, correct: 10, wrong: 0 });
    const r = scheduleStudyPlan(input([t], { hoursPerWeek: 20, examDate: addDays(TODAY, 90) }));
    const reviews = r.items.filter((it) => it.kind === "review").map((it) => it.scheduledFor);
    expect(reviews.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < reviews.length; i++) {
      expect(daysBetween(reviews[i - 1]!, reviews[i]!)).toBeGreaterThanOrEqual(SCHEDULER_PARAMS.minGapDays);
    }
    const bufferStart = addDays(TODAY, r.windowDays - r.bufferDays);
    for (const d of reviews) expect(d < bufferStart).toBe(true);
  });
});

describe("scheduleStudyPlan — interleaving", () => {
  it("never puts three blocks from one section in a row while other sections exist that day", () => {
    const topics = [
      ...Array.from({ length: 6 }, (_, i) => topic(i, { rating: 2, section: "A", canConfirm: false })),
      ...Array.from({ length: 6 }, (_, i) => topic(i + 6, { rating: 2, section: "B", canConfirm: false })),
    ];
    const r = scheduleStudyPlan(input(topics, { hoursPerWeek: 28 }));
    const byDay = new Map<string, PlannedItem[]>();
    for (const it of r.items) byDay.set(it.scheduledFor, [...(byDay.get(it.scheduledFor) ?? []), it]);
    const sectionOf = new Map(topics.map((t) => [t.key, t.sectionId]));
    for (const items of byDay.values()) {
      const seq = [...items].sort((a, b) => a.position - b.position).map((it) => sectionOf.get(it.topicKey)!);
      const countA = seq.filter((s) => s === "A").length;
      const countB = seq.length - countA;
      if (countA === 0 || countB === 0) continue;
      // With both sections present and roughly balanced, runs stay short.
      if (Math.abs(countA - countB) <= 1) {
        for (let i = 2; i < seq.length; i++) {
          expect(!(seq[i] === seq[i - 1] && seq[i] === seq[i - 2])).toBe(true);
        }
      }
    }
  });
});
