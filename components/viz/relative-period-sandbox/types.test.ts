import { describe, expect, it } from "vitest";

import {
  DEFAULT_EARTH_ORBIT_PERIOD_DAYS,
  DEFAULT_PERIOD_A_DAYS,
  DEFAULT_PERIOD_B_DAYS,
  DEFAULT_SIDEREAL_ROTATION_DAYS,
  EARTH_ORBIT_PERIOD_RANGE,
  PERIOD_A_RANGE,
  PERIOD_B_RANGE,
  SIDEREAL_ROTATION_RANGE,
  initialPeriodsOf,
  isRelativePeriodSandboxConfig,
  modeOf,
} from "./types";

describe("isRelativePeriodSandboxConfig", () => {
  it("accepts an empty config: every field is optional", () => {
    expect(isRelativePeriodSandboxConfig({})).toBe(true);
  });

  it("accepts the two page presets from the brief", () => {
    expect(isRelativePeriodSandboxConfig({ mode: "earth-day" })).toBe(true);
    expect(isRelativePeriodSandboxConfig({ mode: "planetary-orbits" })).toBe(true);
    expect(
      isRelativePeriodSandboxConfig({
        mode: "planetary-orbits",
        periodADays: 365.2564,
        periodBDays: 4330.6,
      }),
    ).toBe(true);
    expect(
      isRelativePeriodSandboxConfig({
        mode: "earth-day",
        siderealRotationDays: 0.9972696723,
        earthOrbitPeriodDays: 365.2564,
      }),
    ).toBe(true);
  });

  it.each([null, undefined, "earth-day", 3, true, []])("rejects a non-object: %j", (value) => {
    expect(isRelativePeriodSandboxConfig(value)).toBe(false);
  });

  it("rejects an unknown or mistyped mode", () => {
    expect(isRelativePeriodSandboxConfig({ mode: "mars" })).toBe(false);
    expect(isRelativePeriodSandboxConfig({ mode: 1 })).toBe(false);
  });

  it.each([
    ["siderealRotationDays", SIDEREAL_ROTATION_RANGE],
    ["earthOrbitPeriodDays", EARTH_ORBIT_PERIOD_RANGE],
    ["periodADays", PERIOD_A_RANGE],
    ["periodBDays", PERIOD_B_RANGE],
  ] as const)("%s: accepts both slider bounds and rejects just outside them", (key, range) => {
    expect(isRelativePeriodSandboxConfig({ [key]: range.min })).toBe(true);
    expect(isRelativePeriodSandboxConfig({ [key]: range.max })).toBe(true);
    expect(isRelativePeriodSandboxConfig({ [key]: range.min - range.step })).toBe(false);
    expect(isRelativePeriodSandboxConfig({ [key]: range.max + range.step })).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity, "365", null, 0, -5])(
    "rejects a non-finite, non-numeric or non-positive period: %j",
    (value) => {
      for (const key of ["siderealRotationDays", "earthOrbitPeriodDays", "periodADays", "periodBDays"]) {
        expect(isRelativePeriodSandboxConfig({ [key]: value })).toBe(false);
      }
    },
  );

  it("the Earth-day ranges guarantee the sidereal rotation is shorter than the orbit", () => {
    // This is what keeps 1/τ* − 1/P positive for every reachable slider value.
    expect(SIDEREAL_ROTATION_RANGE.max).toBeLessThan(EARTH_ORBIT_PERIOD_RANGE.min);
  });
});

describe("config accessors", () => {
  it("defaults to the Earth's-day mode", () => {
    expect(modeOf({})).toBe("earth-day");
    expect(modeOf({ mode: "planetary-orbits" })).toBe("planetary-orbits");
  });

  it("falls back to the Earth and Earth–Jupiter defaults", () => {
    expect(initialPeriodsOf({})).toEqual({
      siderealRotationDays: DEFAULT_SIDEREAL_ROTATION_DAYS,
      earthOrbitPeriodDays: DEFAULT_EARTH_ORBIT_PERIOD_DAYS,
      periodADays: DEFAULT_PERIOD_A_DAYS,
      periodBDays: DEFAULT_PERIOD_B_DAYS,
    });
  });

  it("uses the configured value for each period it sets and the default for the rest", () => {
    const periods = initialPeriodsOf({ periodBDays: 4332.59 });
    expect(periods.periodBDays).toBe(4332.59);
    expect(periods.periodADays).toBe(DEFAULT_PERIOD_A_DAYS);
  });

  it("every default is inside its own slider range", () => {
    expect(DEFAULT_SIDEREAL_ROTATION_DAYS).toBeGreaterThanOrEqual(SIDEREAL_ROTATION_RANGE.min);
    expect(DEFAULT_SIDEREAL_ROTATION_DAYS).toBeLessThanOrEqual(SIDEREAL_ROTATION_RANGE.max);
    expect(DEFAULT_EARTH_ORBIT_PERIOD_DAYS).toBeLessThanOrEqual(EARTH_ORBIT_PERIOD_RANGE.max);
    expect(DEFAULT_PERIOD_A_DAYS).toBeLessThanOrEqual(PERIOD_A_RANGE.max);
    expect(DEFAULT_PERIOD_B_DAYS).toBeLessThanOrEqual(PERIOD_B_RANGE.max);
  });
});
