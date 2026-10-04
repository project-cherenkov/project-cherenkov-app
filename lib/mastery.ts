// Mastery estimate for the Phase 3 planner (context-transfer doc, Steps A and
// C). Pure and deterministic: no database, no clock (the caller passes `now`).
//
// Per topic the student's self-rating becomes a WEAK prior, each recorded quiz
// answer is evidence, and the result is a Beta posterior over "probability of
// answering a question on this topic correctly". Older answers count less.
//
// Everything in MASTERY_PARAMS is a [PLACEHOLDER]: a value chosen so the
// design is concrete, never calibrated on real student data. Replace or
// confirm before relying on the numbers.
//
// What this does NOT do: it does not weigh answers by question difficulty
// (the stage's difficulty range decides which questions are asked, in
// lib/osn-stages.ts), and it says nothing about WHEN to study — that is the
// scheduler's job.
import { SELF_RATING_MAX, SELF_RATING_MIN } from "./planner-vocab";

export const MASTERY_PARAMS = {
  // [PLACEHOLDER] Self-rating (1–5) -> prior mean probability of success.
  priorMean: { 1: 0.15, 2: 0.35, 3: 0.55, 4: 0.75, 5: 0.85 } as Record<number, number>,
  // [PLACEHOLDER] Prior strength in pseudo-questions. 2 means two or three
  // real answers outweigh the self-rating (self-assessment is a weak signal).
  priorStrength: 2,
  // [PLACEHOLDER] An answer's weight halves every this many days.
  halfLifeDays: 30,
  // [PLACEHOLDER] Credible-bound quantile: pLower is the 10th percentile and
  // pUpper the 90th percentile of the posterior.
  boundQuantile: 0.1,
  // [PLACEHOLDER] A topic needs at least this many recorded answers before it
  // takes part in the per-student calibration offset.
  calibrationMinAnswers: 2,
  // [PLACEHOLDER] Shrinkage of the calibration offset toward zero:
  // offset = mean gap * k / (k + calibrationShrinkTopics) over k confirmed topics.
  calibrationShrinkTopics: 3,
  // Keeps an adjusted prior strictly inside (0, 1).
  adjustedPriorClamp: [0.02, 0.98] as [number, number],
} as const;

export interface AnswerEvidence {
  correct: boolean;
  answeredAt: Date;
}

export interface TopicEvidence {
  // Latest 1–5 self-rating, or null/undefined if the student has not rated it.
  selfRating?: number | null;
  answers: AnswerEvidence[];
}

// Where the topic stands against a mastery target.
//   unverified — no recorded answers. NOT "failed": nothing is known yet.
//   known      — even the lower bound reaches the target.
//   not_known  — even the upper bound falls short of the target.
//   uncertain  — in between; the evidence cannot say yet.
export type MasteryStatus = "unverified" | "known" | "uncertain" | "not_known";

export interface MasteryEstimate {
  status: MasteryStatus;
  alpha: number;
  beta: number;
  // Posterior mean. For an unverified topic this is the PRIOR mean (adjusted
  // by the calibration offset when one is supplied) — a guess from the
  // self-rating, not a measurement.
  pHat: number;
  pLower: number;
  pUpper: number;
  // Raw number of recorded answers (undecayed).
  answerCount: number;
  // Evidence weight after decay; shows how much the answers still count.
  effectiveAnswers: number;
}

// ---------------------------------------------------------------------------
// Beta distribution helpers (regularized incomplete beta + quantile)
// ---------------------------------------------------------------------------

function logGamma(x: number): number {
  // Lanczos approximation (g = 7, n = 9), accurate to ~1e-15 for x > 0.
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0]!;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Continued fraction for the incomplete beta function (Lentz's method).
function betaContinuedFraction(x: number, a: number, b: number): number {
  const TINY = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return h;
}

// Cumulative distribution function of Beta(a, b) at x.
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(x, a, b)) / a
    : 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

// Inverse of betaCdf by bisection: the x with P(X <= x) = p.
export function betaQuantile(p: number, a: number, b: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Estimate
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function validRating(rating: number | null | undefined): rating is number {
  return (
    typeof rating === "number" &&
    Number.isInteger(rating) &&
    rating >= SELF_RATING_MIN &&
    rating <= SELF_RATING_MAX
  );
}

// Prior mean implied by a self-rating; 0.5 (no opinion) when there is none or
// it is out of range.
export function priorMeanFor(rating: number | null | undefined): number {
  return validRating(rating) ? MASTERY_PARAMS.priorMean[rating]! : 0.5;
}

export function decayWeight(answeredAt: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - answeredAt.getTime()) / DAY_MS);
  return Math.pow(0.5, ageDays / MASTERY_PARAMS.halfLifeDays);
}

function clamp(x: number, [lo, hi]: [number, number]): number {
  return Math.min(hi, Math.max(lo, x));
}

function classify(
  hasAnswers: boolean,
  pLower: number,
  pUpper: number,
  target: number,
): MasteryStatus {
  if (!hasAnswers) return "unverified";
  if (pLower >= target) return "known";
  if (pUpper < target) return "not_known";
  return "uncertain";
}

// `target` is the stage's mastery target (lib/osn-stages.ts).
// `calibrationOffset` (see estimateAllTopics) shifts the prior of topics that
// have no answers yet; it never changes a topic that has real answers.
export function estimateMastery(
  evidence: TopicEvidence,
  target: number,
  now: Date,
  calibrationOffset = 0,
): MasteryEstimate {
  const { priorStrength, boundQuantile, adjustedPriorClamp } = MASTERY_PARAMS;
  const answerCount = evidence.answers.length;
  const hasAnswers = answerCount > 0;

  let p0 = priorMeanFor(evidence.selfRating);
  if (!hasAnswers && validRating(evidence.selfRating)) {
    p0 = clamp(p0 + calibrationOffset, adjustedPriorClamp);
  }

  let alpha = priorStrength * p0;
  let beta = priorStrength * (1 - p0);
  let effectiveAnswers = 0;
  for (const answer of evidence.answers) {
    const w = decayWeight(answer.answeredAt, now);
    effectiveAnswers += w;
    if (answer.correct) alpha += w;
    else beta += w;
  }

  const pLower = betaQuantile(boundQuantile, alpha, beta);
  const pUpper = betaQuantile(1 - boundQuantile, alpha, beta);
  return {
    status: classify(hasAnswers, pLower, pUpper, target),
    alpha,
    beta,
    pHat: alpha / (alpha + beta),
    pLower,
    pUpper,
    answerCount,
    effectiveAnswers,
  };
}

// The student's habit of over- or under-rating themselves, learned from topics
// they have both rated and answered: the mean of (posterior mean − prior
// mean), shrunk toward zero when few topics back it. Negative = overrates.
// Returns 0 when there is nothing to learn from.
export function calibrationOffset(
  topics: TopicEvidence[],
  now: Date,
): number {
  const { calibrationMinAnswers, calibrationShrinkTopics } = MASTERY_PARAMS;
  const gaps: number[] = [];
  for (const topic of topics) {
    if (!validRating(topic.selfRating)) continue;
    if (topic.answers.length < calibrationMinAnswers) continue;
    // Use the uncalibrated estimate: the offset must not feed on itself.
    const est = estimateMastery(topic, 1, now, 0);
    gaps.push(est.pHat - priorMeanFor(topic.selfRating));
  }
  if (gaps.length === 0) return 0;
  const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  return (mean * gaps.length) / (gaps.length + calibrationShrinkTopics);
}

export interface TopicMastery {
  key: string;
  estimate: MasteryEstimate;
}

// Estimates every topic of one student, applying one shared calibration
// offset to the topics that have no answers yet. Output order follows input.
export function estimateAllTopics(
  topics: ({ key: string } & TopicEvidence)[],
  target: number,
  now: Date,
): { offset: number; topics: TopicMastery[] } {
  const offset = calibrationOffset(topics, now);
  return {
    offset,
    topics: topics.map((topic) => ({
      key: topic.key,
      estimate: estimateMastery(topic, target, now, offset),
    })),
  };
}
