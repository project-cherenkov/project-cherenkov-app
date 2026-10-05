// Compares the old even-spread planner with the Phase 3 scheduler on SIMULATED
// students. This tests the scheduling logic, not real-world effectiveness:
// the learner model below (forgetting curve, learning gains, noisy
// self-ratings) is invented, and every number in it is a [PLACEHOLDER]. A win
// here means "the logic does what it was designed to do", never "students
// learn more". Run: pnpm tsx scripts/simulate-planner.ts
import { estimateMastery } from "../lib/mastery";
import { addDays, daysBetween } from "../lib/plan-dates";
import { generatePlanItems } from "../lib/plan-generator";
import { scheduleStudyPlan, type SchedulerTopic } from "../lib/plan-scheduler";

// Small seeded PRNG (mulberry32) so results are reproducible.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TODAY = "2026-10-04";
const TARGET = 0.7;
const NOW = new Date(`${TODAY}T00:00:00Z`);
const TOPICS = 40;

interface Learner {
  k: number; // true knowledge 0..1
  stability: number; // days; larger = forgets slower
  touched: number; // day index of last study/review
}

// [PLACEHOLDER] learner model
function study(l: Learner, day: number, fraction: number) {
  l.k += (1 - l.k) * 0.55 * fraction;
  l.stability = Math.max(l.stability, 12 * fraction + l.stability * (1 - fraction));
  l.touched = day;
}
function review(l: Learner, day: number) {
  l.k += (1 - l.k) * 0.08;
  l.stability *= 2.2;
  l.touched = day;
}
function retrievability(l: Learner, day: number) {
  return l.k * Math.exp(-(day - l.touched) / l.stability);
}

interface Outcome {
  mean: number;
  worst: number;
  atTarget: number;
  minutes: number;
  feasible: boolean;
}

function simulate(seed: number, windowDays: number, hoursPerWeek: number): { base: Outcome; sched: Outcome } {
  const rand = rng(seed);
  const truth = Array.from({ length: TOPICS }, () => ({
    k: rand() < 0.4 ? 0.7 + rand() * 0.25 : rand() * 0.6,
    stability: 4 + rand() * 6,
    rating: 0,
  }));
  // Self-rating = true knowledge plus noise (people mis-judge themselves).
  for (const t of truth) t.rating = Math.min(5, Math.max(1, Math.round(1 + 4 * (t.k + (rand() - 0.5) * 0.5))));
  const exam = addDays(TODAY, windowDays);
  const fresh = () => truth.map((t) => ({ k: t.k, stability: t.stability, touched: -5 }) as Learner);

  // ---- baseline: every topic once, evenly spread, no reviews, no capacity limit
  const a = fresh();
  const plan = generatePlanItems(
    truth.map((_, i) => ({ id: String(i), subject: "physics" as const, order: i })),
    addDays(exam, -1),
    TODAY,
  );
  for (const item of plan) study(a[Number(item.topicId)]!, daysBetween(TODAY, item.scheduledFor), 1);

  // ---- new scheduler (plans from self-ratings only; no quiz feedback loop)
  const b = fresh();
  const topics: SchedulerTopic[] = truth.map((t, i) => ({
    key: String(i),
    sectionId: `s${i % 5}`,
    order: i,
    effort: 2,
    selfRating: t.rating,
    estimate: estimateMastery({ selfRating: t.rating, answers: [] }, TARGET, NOW),
    canConfirm: true,
  }));
  const result = scheduleStudyPlan({ topics, today: TODAY, examDate: exam, hoursPerWeek, masteryTarget: TARGET });
  const studied = new Map<string, number>();
  for (const item of result.items) {
    const l = b[Number(item.topicKey)]!;
    const day = daysBetween(TODAY, item.scheduledFor);
    if (item.kind === "study") {
      const total = 60;
      study(l, day, item.minutes / total);
      studied.set(item.topicKey, (studied.get(item.topicKey) ?? 0) + item.minutes);
    } else if (item.kind === "review" || item.kind === "final_review") review(l, day);
    // "confirm" quizzes only tell the PLANNER something; they do not teach.
  }

  const score = (ls: Learner[], minutes: number, feasible: boolean): Outcome => {
    const r = ls.map((l) => retrievability(l, windowDays));
    return {
      mean: r.reduce((s, x) => s + x, 0) / r.length,
      worst: Math.min(...r),
      atTarget: r.filter((x) => x >= TARGET).length / r.length,
      minutes,
      feasible,
    };
  };
  const baseMinutes = plan.length * 60;
  const schedMinutes = result.items.reduce((s, i) => s + i.minutes, 0);
  return { base: score(a, baseMinutes, true), sched: score(b, schedMinutes, result.feasible) };
}

function avg(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

const RUNS = 200;
console.log(`Simulated learners: ${RUNS} per row, ${TOPICS} topics, target ${TARGET}. Placeholder learner model — logic check only.\n`);
console.log("window  h/wk | even-spread: mean  worst  >=tgt  minutes | scheduler: mean  worst  >=tgt  minutes  infeasible");
for (const [windowDays, hours] of [[120, 6], [60, 6], [60, 12], [30, 6], [30, 14]] as const) {
  const rows = Array.from({ length: RUNS }, (_, i) => simulate(1000 + i, windowDays, hours));
  const f = (n: number) => n.toFixed(2);
  console.log(
    `${String(windowDays).padStart(5)}d  ${String(hours).padStart(4)} | ` +
      `${f(avg(rows.map((r) => r.base.mean)))}  ${f(avg(rows.map((r) => r.base.worst)))}  ${f(avg(rows.map((r) => r.base.atTarget)))}  ${String(Math.round(avg(rows.map((r) => r.base.minutes)))).padStart(7)} | ` +
      `${f(avg(rows.map((r) => r.sched.mean)))}  ${f(avg(rows.map((r) => r.sched.worst)))}  ${f(avg(rows.map((r) => r.sched.atTarget)))}  ${String(Math.round(avg(rows.map((r) => r.sched.minutes)))).padStart(7)}   ${f(rows.filter((r) => !r.sched.feasible).length / RUNS)}`,
  );
}
console.log("\nNote: even-spread ignores weekly hours entirely (its 'minutes' can exceed what a student has); the scheduler never does.");
