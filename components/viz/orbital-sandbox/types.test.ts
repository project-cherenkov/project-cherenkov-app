import { describe, expect, it } from "vitest";
import { isOrbitalSandboxConfig } from "./types";

const VALID = {
  eccentricity: 0.3,
  semiMajorAxisPx: 130,
  periodSeconds: 6,
  massRatio: 0.05,
};

// ROBUST-001 / TICKET-03 required test: isOrbitalSandboxConfig must reject
// out-of-range numeric values, not just wrong types — eccentricity >= 1
// produces a confirmed 0/0 division in solveEccentricAnomaly's
// Newton-Raphson step (components/viz/orbital-sandbox/index.tsx).
describe("isOrbitalSandboxConfig", () => {
  it("accepts a valid config", () => {
    expect(isOrbitalSandboxConfig(VALID)).toBe(true);
  });

  it("accepts a valid config without the optional massRatio", () => {
    const { massRatio: _massRatio, ...rest } = VALID;
    expect(isOrbitalSandboxConfig(rest)).toBe(true);
  });

  it("rejects eccentricity == 1 (parabolic — divides by zero in the solver)", () => {
    expect(isOrbitalSandboxConfig({ ...VALID, eccentricity: 1 })).toBe(
      false,
    );
  });

  it("rejects eccentricity > 1 (hyperbolic)", () => {
    expect(isOrbitalSandboxConfig({ ...VALID, eccentricity: 1.2 })).toBe(
      false,
    );
  });

  it("rejects negative eccentricity", () => {
    expect(isOrbitalSandboxConfig({ ...VALID, eccentricity: -0.1 })).toBe(
      false,
    );
  });

  it("accepts eccentricity == 0 (circular orbit)", () => {
    expect(isOrbitalSandboxConfig({ ...VALID, eccentricity: 0 })).toBe(true);
  });

  it("rejects non-positive semiMajorAxisPx", () => {
    expect(isOrbitalSandboxConfig({ ...VALID, semiMajorAxisPx: 0 })).toBe(
      false,
    );
    expect(isOrbitalSandboxConfig({ ...VALID, semiMajorAxisPx: -5 })).toBe(
      false,
    );
  });

  it("rejects non-positive periodSeconds", () => {
    expect(isOrbitalSandboxConfig({ ...VALID, periodSeconds: 0 })).toBe(
      false,
    );
    expect(isOrbitalSandboxConfig({ ...VALID, periodSeconds: -6 })).toBe(
      false,
    );
  });

  it("rejects a negative massRatio", () => {
    expect(isOrbitalSandboxConfig({ ...VALID, massRatio: -0.05 })).toBe(
      false,
    );
  });

  it("rejects an invalid eccentricityRange upper bound", () => {
    expect(
      isOrbitalSandboxConfig({ ...VALID, eccentricityRange: [0, 1] }),
    ).toBe(false);
    expect(
      isOrbitalSandboxConfig({ ...VALID, eccentricityRange: [0, 1.2] }),
    ).toBe(false);
  });

  it("rejects a negative massRatioRange lower bound", () => {
    expect(
      isOrbitalSandboxConfig({ ...VALID, massRatioRange: [-0.1, 0.2] }),
    ).toBe(false);
  });

  it("rejects a non-object config", () => {
    expect(isOrbitalSandboxConfig(null)).toBe(false);
    expect(isOrbitalSandboxConfig(42)).toBe(false);
  });
});
