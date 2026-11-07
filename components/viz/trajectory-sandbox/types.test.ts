import { describe, expect, it } from "vitest";
import { isTrajectorySandboxConfig } from "./types";

const VALID = {
  physicsType: "projectile",
  gravity: 9.8,
  initial: { speed: 20, angleDeg: 45 },
};

describe("isTrajectorySandboxConfig", () => {
  it("accepts a valid config", () => {
    expect(isTrajectorySandboxConfig(VALID)).toBe(true);
  });

  it("rejects a missing initial state", () => {
    const { initial: _initial, ...withoutInitial } = VALID;
    expect(isTrajectorySandboxConfig(withoutInitial)).toBe(false);
  });

  it("rejects malformed initial values and ranges", () => {
    expect(
      isTrajectorySandboxConfig({ ...VALID, initial: { speed: "fast", angleDeg: 45 } }),
    ).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, angleRange: [85, 5] })).toBe(false);
  });

  it("rejects angles above 90 degrees", () => {
    expect(isTrajectorySandboxConfig({ ...VALID, initial: { speed: 20, angleDeg: 91 } })).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, angleRange: [5, 95] })).toBe(false);
  });
});

// ARCH-001 / TICKET-02 required test: an unrecognized physicsType must not
// pass the guard — previously it did, and crashed TrajectorySandbox's
// non-null PHYSICS_FUNCTIONS lookup at render time.
describe("isTrajectorySandboxConfig", () => {
  it("accepts a valid, registered config", () => {
    expect(isTrajectorySandboxConfig(VALID)).toBe(true);
  });

  it("rejects an unrecognized physicsType", () => {
    expect(
      isTrajectorySandboxConfig({ ...VALID, physicsType: "bogus" }),
    ).toBe(false);
  });

  it("rejects a non-string physicsType", () => {
    expect(isTrajectorySandboxConfig({ ...VALID, physicsType: 5 })).toBe(
      false,
    );
  });

  // ROBUST-001 / TICKET-03: gravity must be positive — index.tsx divides
  // by it to compute flightTime.
  it("rejects zero gravity", () => {
    expect(isTrajectorySandboxConfig({ ...VALID, gravity: 0 })).toBe(false);
  });

  it("rejects negative gravity", () => {
    expect(isTrajectorySandboxConfig({ ...VALID, gravity: -9.8 })).toBe(
      false,
    );
  });

  it("rejects a non-number gravity", () => {
    expect(isTrajectorySandboxConfig({ ...VALID, gravity: "9.8" })).toBe(
      false,
    );
  });

  it("rejects a non-object config", () => {
    expect(isTrajectorySandboxConfig(null)).toBe(false);
    expect(isTrajectorySandboxConfig("projectile")).toBe(false);
  });
});

// R3 (docs/viz-interaction-improvements.md): the optional `challenge` field.
// Default ranges are speed 5..40 m/s, angle 5..85°, g = 9.8, so the furthest
// reachable landing is about 40² · sin(90°) / 9.8 ≈ 163 m and the nearest
// about 5² · sin(10°) / 9.8 ≈ 0.44 m.
describe("isTrajectorySandboxConfig — challenge (R3)", () => {
  const challenge = {
    prompt: "Land the ball on the **target**.",
    target: { rangeM: 40, toleranceM: 2 },
  };

  it("a config without a challenge validates exactly as before", () => {
    expect(isTrajectorySandboxConfig(VALID)).toBe(true);
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: undefined })).toBe(true);
  });

  it("accepts a well-formed, solvable challenge, with or without hint and successNote", () => {
    expect(isTrajectorySandboxConfig({ ...VALID, challenge })).toBe(true);
    expect(
      isTrajectorySandboxConfig({
        ...VALID,
        challenge: { ...challenge, hint: "Think about $\\sin 2\\theta$.", successNote: "Nice." },
      }),
    ).toBe(true);
  });

  it("rejects a challenge that is beyond the furthest reachable range", () => {
    expect(
      isTrajectorySandboxConfig({ ...VALID, challenge: { ...challenge, target: { rangeM: 1000, toleranceM: 2 } } }),
    ).toBe(false);
  });

  it("rejects a challenge that is nearer than the nearest reachable range", () => {
    expect(
      isTrajectorySandboxConfig({ ...VALID, challenge: { ...challenge, target: { rangeM: 0.05, toleranceM: 0.01 } } }),
    ).toBe(false);
  });

  it("judges solvability against the configured speedRange/angleRange, not just the defaults", () => {
    // Reachable with the default 5..40 m/s, but not once speed is capped at 10 m/s
    // (10² / 9.8 ≈ 10.2 m is the most a 10 m/s launch can cover).
    expect(isTrajectorySandboxConfig({ ...VALID, speedRange: [5, 10], challenge })).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, speedRange: [5, 20], challenge })).toBe(true);
  });

  it("judges solvability on the slider grid: a range reachable only between two notches is rejected", () => {
    // Speeds 10 and 11 m/s at 45° land at about 10.20 m and 12.35 m. A
    // continuous speed of about 10.5 m/s would hit 11.2 m, but no slider
    // setting can.
    const narrow = {
      ...VALID,
      speedRange: [10, 11] as [number, number],
      angleRange: [45, 45] as [number, number],
    };
    expect(
      isTrajectorySandboxConfig({ ...narrow, challenge: { ...challenge, target: { rangeM: 11.2, toleranceM: 0.1 } } }),
    ).toBe(false);
    expect(
      isTrajectorySandboxConfig({ ...narrow, challenge: { ...challenge, target: { rangeM: 12.3, toleranceM: 0.1 } } }),
    ).toBe(true);
  });

  it("rejects non-positive or non-finite rangeM / toleranceM", () => {
    for (const target of [
      { rangeM: 40, toleranceM: 0 },
      { rangeM: 40, toleranceM: -1 },
      { rangeM: 0, toleranceM: 2 },
      { rangeM: -40, toleranceM: 2 },
      { rangeM: Number.NaN, toleranceM: 2 },
      { rangeM: 40, toleranceM: Number.POSITIVE_INFINITY },
      { rangeM: "40", toleranceM: 2 },
    ]) {
      expect(isTrajectorySandboxConfig({ ...VALID, challenge: { ...challenge, target } }), JSON.stringify(target)).toBe(
        false,
      );
    }
  });

  it("rejects malformed challenge objects", () => {
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: null })).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: "easy" })).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: [] })).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: { target: challenge.target } })).toBe(false); // no prompt
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: { ...challenge, prompt: "   " } })).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: { prompt: "x" } })).toBe(false); // no target
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: { ...challenge, target: null } })).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: { ...challenge, hint: 5 } })).toBe(false);
    expect(isTrajectorySandboxConfig({ ...VALID, challenge: { ...challenge, successNote: {} } })).toBe(false);
  });

  it("does not hang on a pathologically wide speedRange", () => {
    expect(isTrajectorySandboxConfig({ ...VALID, speedRange: [1, 1e9], challenge })).toBe(false);
  });
});
