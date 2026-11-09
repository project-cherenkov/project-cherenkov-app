import { describe, expect, it } from "vitest";

import {
  CYCLE_SECONDS,
  INITIAL_DIRECTION,
  TWO_PI,
  advancePhase,
  clampPhase,
  earthDayState,
  formatFixed,
  formatHms,
  formatSignificant,
  meanSolarDayDays,
  planetaryState,
  polarToCanvas,
  radiansToDegrees,
  synodicPeriodDays,
  wrapAngle,
} from "./physics-functions";

// The test values from the brief (section 11), computed from the closed-form
// equations at full precision.
describe("mean solar day (Earth's day mode)", () => {
  it("Earth reference case: 24 hours", () => {
    expect(
      meanSolarDayDays({ siderealRotationDays: 0.9972696722842249, earthOrbitPeriodDays: 365.2564 }),
    ).toBeCloseTo(1.0, 9);
  });

  it("the page default (0.9972696723 d) also gives 1.000000 d at displayed precision", () => {
    const tau = meanSolarDayDays({ siderealRotationDays: 0.9972696723, earthOrbitPeriodDays: 365.2564 })!;
    expect(tau.toFixed(6)).toBe("1.000000");
  });

  it("faster rotation and a short year", () => {
    expect(meanSolarDayDays({ siderealRotationDays: 0.5, earthOrbitPeriodDays: 100 })).toBeCloseTo(0.5025125628, 9);
  });

  it("orbital correction at a shorter orbital period", () => {
    expect(meanSolarDayDays({ siderealRotationDays: 1.0, earthOrbitPeriodDays: 10 })).toBeCloseTo(1.1111111111, 9);
  });

  it("returns null rather than infinity or a negative day when 1/τ* ≤ 1/P", () => {
    expect(meanSolarDayDays({ siderealRotationDays: 10, earthOrbitPeriodDays: 10 })).toBeNull();
    expect(meanSolarDayDays({ siderealRotationDays: 20, earthOrbitPeriodDays: 10 })).toBeNull();
  });
});

describe("synodic period (planetary orbits mode)", () => {
  it("Earth–Jupiter", () => {
    expect(synodicPeriodDays({ periodADays: 365.2564, periodBDays: 4330.6 })).toBeCloseTo(398.9009593, 6);
  });

  it("simple reciprocal-period check", () => {
    expect(synodicPeriodDays({ periodADays: 100, periodBDays: 200 })).toBeCloseTo(200, 9);
  });

  it("is symmetric in A and B (it uses the magnitude of the relative rate)", () => {
    const forward = synodicPeriodDays({ periodADays: 365.2564, periodBDays: 4330.6 })!;
    const swapped = synodicPeriodDays({ periodADays: 4330.6, periodBDays: 365.2564 })!;
    expect(swapped).toBeCloseTo(forward, 9);
  });

  it("has no finite value when the periods are equal", () => {
    expect(synodicPeriodDays({ periodADays: 100, periodBDays: 100 })).toBeNull();
  });
});

describe("Earth's day state", () => {
  const earth = { siderealRotationDays: 0.9972696722842249, earthOrbitPeriodDays: 365.2564 };

  it("starts with the meridian, Sun direction and star reference coincident", () => {
    const s = earthDayState(earth, 0)!;
    expect(s.meridianAngle).toBe(INITIAL_DIRECTION);
    expect(s.sunAngle).toBe(INITIAL_DIRECTION);
    expect(s.starAngle).toBe(INITIAL_DIRECTION);
    expect(s.meridianToSun).toBe(0);
    expect(s.orbitAngle).toBe(0);
  });

  it("the Sun returns to the meridian at u = 1: a relative turn of 2π, read as 0°", () => {
    const s = earthDayState(earth, 1)!;
    expect(s.meridianAngle - s.sunAngle).toBeCloseTo(TWO_PI, 9);
    expect(s.meridianToSun).toBe(0);
  });

  it("is halfway round (π) at u = 0.5", () => {
    expect(earthDayState(earth, 0.5)!.meridianToSun).toBeCloseTo(Math.PI, 9);
  });

  it("the meridian is back on the star direction before the Sun is: at u = τ*/τ", () => {
    const at = earthDayState(earth, earthDayState(earth, 0)!.siderealReturnPhase)!;
    expect(at.meridianToStar).toBeCloseTo(0, 9);
    // The Sun direction has moved on by Earth's orbital advance during one
    // sidereal rotation, so the meridian has not yet caught up with it: it
    // still has that small angle left to turn (reading 359.0°, just short of
    // a full turn).
    const remaining = 360 - radiansToDegrees(at.meridianToSun);
    expect(remaining).toBeGreaterThan(0.9);
    expect(remaining).toBeCloseTo((360 / earth.earthOrbitPeriodDays) * earth.siderealRotationDays, 6);
  });

  it("the sidereal return comes just before the solar one", () => {
    const phase = earthDayState(earth, 0)!.siderealReturnPhase;
    expect(phase).toBeGreaterThan(0.99);
    expect(phase).toBeLessThan(1);
  });

  it("Earth advances about 0.9856° along its orbit per mean solar day", () => {
    expect(earthDayState(earth, 0)!.orbitalAdvanceDegrees).toBeCloseTo(0.9856, 4);
    // …and the orbit marker really moves by that much over one cycle.
    expect(radiansToDegrees(earthDayState(earth, 1)!.orbitAngle)).toBeCloseTo(0.9856, 4);
  });

  it("clamps the phase to [0, 1]", () => {
    expect(earthDayState(earth, 2)!.timeDays).toBeCloseTo(earthDayState(earth, 1)!.timeDays, 12);
    expect(earthDayState(earth, -1)!.timeDays).toBe(0);
  });

  it("returns null when there is no positive prograde relative rate", () => {
    expect(earthDayState({ siderealRotationDays: 10, earthOrbitPeriodDays: 10 }, 0.5)).toBeNull();
  });
});

describe("planetary state", () => {
  const earthJupiter = { periodADays: 365.2564, periodBDays: 4330.6 };

  it("starts with both bodies at longitude 0 and a zero relative angle", () => {
    const s = planetaryState(earthJupiter, 0);
    expect(s).toMatchObject({ cycleAvailable: true, longitudeA: 0, longitudeB: 0, relativeAngle: 0, timeDays: 0 });
  });

  it("has advanced the relative angle by π at u = 0.5", () => {
    expect(planetaryState(earthJupiter, 0.5).relativeAngle).toBeCloseTo(Math.PI, 9);
  });

  it("repeats the relative configuration at u = 1, though absolute longitudes differ", () => {
    const s = planetaryState(earthJupiter, 1);
    expect(s.timeDays).toBeCloseTo(398.9009593, 6);
    expect(s.relativeAngle).toBe(0);
    // Earth has gone round more than once, Jupiter by about a twelfth of a turn.
    expect(s.longitudeA).toBeGreaterThan(TWO_PI);
    expect(s.longitudeB).toBeLessThan(TWO_PI / 8);
    expect(s.longitudeA - s.longitudeB).toBeCloseTo(TWO_PI, 9);
  });

  it("when A is the slower body the relative angle runs the other way and still repeats", () => {
    const slowA = { periodADays: 4330.6, periodBDays: 365.2564 };
    expect(planetaryState(slowA, 0.25).relativeAngle).toBeCloseTo((3 * Math.PI) / 2, 9);
    expect(planetaryState(slowA, 1).relativeAngle).toBe(0);
  });

  it("makes no cycle when the periods are equal and holds the bodies at the start", () => {
    const s = planetaryState({ periodADays: 100, periodBDays: 100 }, 0.7);
    expect(s).toEqual({
      cycleAvailable: false,
      synodicPeriodDays: null,
      timeDays: 0,
      longitudeA: 0,
      longitudeB: 0,
      relativeAngle: 0,
    });
  });
});

describe("angles and playback helpers", () => {
  it("wrapAngle maps into [0, 2π) and snaps a repeated full turn to 0", () => {
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(wrapAngle(3 * TWO_PI + 0.5)).toBeCloseTo(0.5, 9);
    expect(wrapAngle(TWO_PI)).toBe(0);
    expect(wrapAngle(TWO_PI - 1e-12)).toBe(0);
    expect(wrapAngle(TWO_PI - 1e-3)).toBeCloseTo(TWO_PI - 1e-3, 12);
  });

  it("polarToCanvas draws prograde motion counterclockwise (y points down)", () => {
    expect(polarToCanvas(100, 100, 50, 0)).toEqual({ x: 150, y: 100 });
    const up = polarToCanvas(100, 100, 50, Math.PI / 2);
    expect(up.x).toBeCloseTo(100, 9);
    expect(up.y).toBeCloseTo(50, 9);
  });

  it("one synodic cycle takes 12 seconds, runs linearly and stops at 1 without wrapping", () => {
    expect(CYCLE_SECONDS).toBe(12);
    expect(advancePhase(0, 6)).toBeCloseTo(0.5, 12);
    expect(advancePhase(0.9, 5)).toBe(1);
    expect(clampPhase(1.5)).toBe(1);
    expect(clampPhase(-0.5)).toBe(0);
  });
});

describe("display formatting", () => {
  it("formats a mean solar day of 1 d as 24 h 0 min 0.0 s", () => {
    expect(formatHms(1, "en")).toBe("24 h 0 min 0.0 s");
  });

  it("formats the sidereal day as 23 h 56 min 4.1 s", () => {
    expect(formatHms(0.9972696723, "en")).toBe("23 h 56 min 4.1 s");
  });

  it("carries rounding into the next minute instead of printing 60.0 s", () => {
    // 59.96 s rounds to 60.0 s, which must read 1 min 0.0 s.
    expect(formatHms(59.96 / 86400, "en")).toBe("0 h 1 min 0.0 s");
  });

  it("uses the locale's decimal separator", () => {
    expect(formatFixed(398.9009593, 3, "en")).toBe("398.901");
    expect(formatFixed(398.9009593, 3, "id")).toBe("398,901");
    expect(formatHms(0.9972696723, "id")).toBe("23 h 56 min 4,1 s");
  });

  it("rounds only on display: the unrounded model value is untouched", () => {
    const s = synodicPeriodDays({ periodADays: 365.2564, periodBDays: 4330.6 })!;
    expect(formatFixed(s, 3, "en")).toBe("398.901");
    expect(s).not.toBe(398.901);
  });

  it("formats elapsed time to four significant figures", () => {
    expect(formatSignificant(398.9009593, 4, "en")).toBe("398.9");
    expect(formatSignificant(0, 4, "en")).toBe("0");
  });
});
