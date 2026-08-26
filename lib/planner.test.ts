import { describe, expect, it } from "vitest";
import { deriveStatusFromAttempts, MASTERY_THRESHOLD } from "./planner";

// PLANNER-001 required test (spec §8, decision #5): "seed attempts with
// scores [0.9, 0.5] in that order -> status in_progress (most recent wins,
// not best); [0.5, 0.9] -> done."
describe("deriveStatusFromAttempts", () => {
  it("returns not_started when there are no attempts", () => {
    expect(deriveStatusFromAttempts([])).toBe("not_started");
  });

  it("uses the most recent attempt, not the best one — high then low", () => {
    const attempts = [
      { score: 0.9, attemptedAt: "2026-01-01T00:00:00Z" },
      { score: 0.5, attemptedAt: "2026-01-02T00:00:00Z" }, // more recent
    ];
    expect(deriveStatusFromAttempts(attempts)).toBe("in_progress");
  });

  it("uses the most recent attempt, not the best one — low then high", () => {
    const attempts = [
      { score: 0.5, attemptedAt: "2026-01-01T00:00:00Z" },
      { score: 0.9, attemptedAt: "2026-01-02T00:00:00Z" }, // more recent
    ];
    expect(deriveStatusFromAttempts(attempts)).toBe("done");
  });

  it("does not depend on array insertion order, only attemptedAt", () => {
    // Same two attempts as the "low then high" case above, but inserted in
    // the opposite array order — result must be identical.
    const attempts = [
      { score: 0.9, attemptedAt: "2026-01-02T00:00:00Z" },
      { score: 0.5, attemptedAt: "2026-01-01T00:00:00Z" },
    ];
    expect(deriveStatusFromAttempts(attempts)).toBe("done");
  });

  it(`treats a score exactly at the ${MASTERY_THRESHOLD} threshold as done`, () => {
    expect(
      deriveStatusFromAttempts([
        { score: MASTERY_THRESHOLD, attemptedAt: "2026-01-01T00:00:00Z" },
      ]),
    ).toBe("done");
  });

  it("treats a single below-threshold attempt as in_progress, not not_started", () => {
    expect(
      deriveStatusFromAttempts([
        { score: 0.3, attemptedAt: "2026-01-01T00:00:00Z" },
      ]),
    ).toBe("in_progress");
  });
});
