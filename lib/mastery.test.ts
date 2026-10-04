import { describe, expect, it } from "vitest";
import {
  betaCdf,
  betaQuantile,
  calibrationOffset,
  decayWeight,
  estimateAllTopics,
  estimateMastery,
  MASTERY_PARAMS,
  priorMeanFor,
  type AnswerEvidence,
} from "./mastery";

const NOW = new Date("2026-10-04T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const answers = (correct: number, wrong: number, ageDays = 0): AnswerEvidence[] => [
  ...Array.from({ length: correct }, () => ({ correct: true, answeredAt: daysAgo(ageDays) })),
  ...Array.from({ length: wrong }, () => ({ correct: false, answeredAt: daysAgo(ageDays) })),
];

describe("Beta helpers match known values", () => {
  it("Beta(1,1) is uniform", () => {
    expect(betaCdf(0.3, 1, 1)).toBeCloseTo(0.3, 10);
    expect(betaQuantile(0.1, 1, 1)).toBeCloseTo(0.1, 8);
  });

  it("Beta(2,2) has cdf 3x² − 2x³", () => {
    for (const x of [0.1, 0.25, 0.5, 0.8]) {
      expect(betaCdf(x, 2, 2)).toBeCloseTo(3 * x * x - 2 * x ** 3, 10);
    }
  });

  it("Beta(2,5) has the closed-form cdf 1 − (1−x)⁵(1+5x)", () => {
    for (const x of [0.05, 0.3, 0.6, 0.9]) {
      expect(betaCdf(x, 2, 5)).toBeCloseTo(1 - (1 - x) ** 5 * (1 + 5 * x), 10);
    }
  });

  it("is symmetric: Beta(a,b) at x equals 1 − Beta(b,a) at 1−x", () => {
    expect(betaCdf(0.37, 3.3, 1.7)).toBeCloseTo(1 - betaCdf(0.63, 1.7, 3.3), 10);
  });

  it("quantile inverts the cdf, including non-integer parameters", () => {
    for (const [a, b] of [[0.3, 1.7], [4.1, 0.9], [12.5, 3.2]] as const) {
      for (const p of [0.05, 0.1, 0.5, 0.9, 0.95]) {
        expect(betaCdf(betaQuantile(p, a, b), a, b)).toBeCloseTo(p, 8);
      }
    }
  });
});

describe("priors from self-rating", () => {
  it("maps each valid rating, increasing with the rating", () => {
    const means = [1, 2, 3, 4, 5].map(priorMeanFor);
    expect([...means].sort((a, b) => a - b)).toEqual(means);
    expect(means[0]).toBeLessThan(means[4]!);
  });

  it("falls back to 0.5 for a missing or invalid rating", () => {
    for (const bad of [null, undefined, 0, 6, 2.5, Number.NaN]) {
      expect(priorMeanFor(bad)).toBe(0.5);
    }
  });
});

describe("estimateMastery", () => {
  it("no answers means unverified — not failed — even with a low self-rating", () => {
    const e = estimateMastery({ selfRating: 1, answers: [] }, 0.7, NOW);
    expect(e.status).toBe("unverified");
    expect(e.answerCount).toBe(0);
    expect(e.pHat).toBeCloseTo(0.15, 10);
  });

  it("no answers and no rating is unverified with an uninformative prior", () => {
    const e = estimateMastery({ answers: [] }, 0.7, NOW);
    expect(e).toMatchObject({ status: "unverified", alpha: 1, beta: 1 });
  });

  it("a weak self-rating prior is outweighed by a few real answers", () => {
    // Student rates themselves 5 (prior 0.85) but gets 3 of 3 wrong.
    const e = estimateMastery({ selfRating: 5, answers: answers(0, 3) }, 0.7, NOW);
    expect(e.pHat).toBeLessThan(0.4);
    expect(e.status).toBe("not_known");
    // ...and the reverse: rates 1 (prior 0.15), gets 3 of 3 right.
    const f = estimateMastery({ selfRating: 1, answers: answers(3, 0) }, 0.7, NOW);
    expect(f.pHat).toBeGreaterThan(0.6);
  });

  it("lets plenty of correct answers reach known", () => {
    const e = estimateMastery({ selfRating: 3, answers: answers(10, 0) }, 0.7, NOW);
    expect(e.status).toBe("known");
    expect(e.pLower).toBeGreaterThanOrEqual(0.7);
  });

  it("stays uncertain when the evidence is thin, even if all correct", () => {
    const e = estimateMastery({ selfRating: 3, answers: answers(2, 0) }, 0.7, NOW);
    expect(e.status).toBe("uncertain");
  });

  it("orders the bounds: pLower <= pHat <= pUpper, all within [0, 1]", () => {
    for (const [c, w] of [[0, 0], [1, 0], [0, 4], [5, 5], [20, 1]]) {
      const e = estimateMastery({ selfRating: 3, answers: answers(c!, w!) }, 0.8, NOW);
      expect(e.pLower).toBeLessThanOrEqual(e.pHat);
      expect(e.pHat).toBeLessThanOrEqual(e.pUpper);
      expect(e.pLower).toBeGreaterThanOrEqual(0);
      expect(e.pUpper).toBeLessThanOrEqual(1);
    }
  });

  it("is more demanding at a higher target", () => {
    const ev = { selfRating: 3, answers: answers(6, 0) };
    expect(estimateMastery(ev, 0.5, NOW).status).toBe("known");
    expect(estimateMastery(ev, 0.95, NOW).status).not.toBe("known");
  });

  it("is deterministic and ignores answer order", () => {
    const list = [...answers(3, 2, 1), ...answers(1, 1, 40)];
    const a = estimateMastery({ selfRating: 2, answers: list }, 0.7, NOW);
    const b = estimateMastery({ selfRating: 2, answers: [...list].reverse() }, 0.7, NOW);
    expect(b).toEqual(a);
  });
});

describe("recency decay", () => {
  it("halves an answer's weight every half-life", () => {
    const h = MASTERY_PARAMS.halfLifeDays;
    expect(decayWeight(NOW, NOW)).toBe(1);
    expect(decayWeight(daysAgo(h), NOW)).toBeCloseTo(0.5, 10);
    expect(decayWeight(daysAgo(2 * h), NOW)).toBeCloseTo(0.25, 10);
  });

  it("does not boost an answer dated in the future", () => {
    expect(decayWeight(new Date(NOW.getTime() + 86_400_000), NOW)).toBe(1);
  });

  it("lets old answers fade toward the prior but never to unverified", () => {
    const fresh = estimateMastery({ selfRating: 3, answers: answers(0, 4, 0) }, 0.7, NOW);
    const stale = estimateMastery({ selfRating: 3, answers: answers(0, 4, 365) }, 0.7, NOW);
    expect(stale.effectiveAnswers).toBeLessThan(fresh.effectiveAnswers);
    expect(stale.pHat).toBeGreaterThan(fresh.pHat);
    expect(stale.pHat).toBeCloseTo(priorMeanFor(3), 1);
    expect(stale.status).not.toBe("unverified");
    expect(stale.answerCount).toBe(4);
  });

  it("weighs a recent answer more than an old one", () => {
    const recentRight = estimateMastery({ selfRating: 3, answers: [...answers(1, 0, 0), ...answers(0, 1, 120)] }, 0.7, NOW);
    const oldRight = estimateMastery({ selfRating: 3, answers: [...answers(1, 0, 120), ...answers(0, 1, 0)] }, 0.7, NOW);
    expect(recentRight.pHat).toBeGreaterThan(oldRight.pHat);
  });
});

describe("per-student calibration", () => {
  const overrater = (n: number) =>
    Array.from({ length: n }, () => ({ selfRating: 5, answers: answers(1, 3) }));

  it("is zero when there is nothing to learn from", () => {
    expect(calibrationOffset([], NOW)).toBe(0);
    expect(calibrationOffset([{ selfRating: 4, answers: [] }], NOW)).toBe(0);
    expect(calibrationOffset([{ selfRating: 4, answers: answers(1, 0) }], NOW)).toBe(0); // too few answers
    expect(calibrationOffset([{ answers: answers(2, 2) }], NOW)).toBe(0); // no rating
  });

  it("is negative for a student who overrates, positive for one who underrates", () => {
    expect(calibrationOffset(overrater(4), NOW)).toBeLessThan(0);
    const under = Array.from({ length: 4 }, () => ({ selfRating: 1, answers: answers(4, 0) }));
    expect(calibrationOffset(under, NOW)).toBeGreaterThan(0);
  });

  it("is shrunk toward zero when few topics back it, growing with more evidence", () => {
    const one = Math.abs(calibrationOffset(overrater(1), NOW));
    const many = Math.abs(calibrationOffset(overrater(12), NOW));
    expect(one).toBeLessThan(many);
  });

  it("adjusts only topics with no answers, and never makes them 'verified'", () => {
    const topics = [
      ...overrater(4).map((t, i) => ({ key: `c${i}`, ...t })),
      { key: "fresh", selfRating: 5, answers: [] as AnswerEvidence[] },
      { key: "bare", answers: [] as AnswerEvidence[] },
    ];
    const { offset, topics: out } = estimateAllTopics(topics, 0.7, NOW);
    expect(offset).toBeLessThan(0);

    const fresh = out.find((t) => t.key === "fresh")!.estimate;
    expect(fresh.status).toBe("unverified");
    expect(fresh.pHat).toBeLessThan(priorMeanFor(5)); // pulled down: this student overrates

    const bare = out.find((t) => t.key === "bare")!.estimate;
    expect(bare.pHat).toBe(0.5); // no rating, nothing to adjust

    const confirmed = out.find((t) => t.key === "c0")!.estimate;
    expect(confirmed).toEqual(estimateMastery(topics[0]!, 0.7, NOW)); // unchanged by the offset
  });

  it("keeps an adjusted prior inside (0, 1)", () => {
    const e = estimateMastery({ selfRating: 1, answers: [] }, 0.7, NOW, -5);
    expect(e.pHat).toBeGreaterThan(0);
    const f = estimateMastery({ selfRating: 5, answers: [] }, 0.7, NOW, 5);
    expect(f.pHat).toBeLessThan(1);
  });

  it("preserves input order and keys", () => {
    const topics = ["z", "a", "m"].map((key) => ({ key, answers: [] as AnswerEvidence[] }));
    expect(estimateAllTopics(topics, 0.7, NOW).topics.map((t) => t.key)).toEqual(["z", "a", "m"]);
  });
});
