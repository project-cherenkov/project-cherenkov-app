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
