// Config for the `relative-period-sandbox` engine: one instrument, two modes,
// one idea. A recurrence interval depends on the reference the motion is
// measured against.
//
//   earth-day         Earth's sidereal rotation against the distant stars, and
//                     the mean solar day that results once Earth's orbital
//                     motion moves the Sun's direction.
//   planetary-orbits  Two coplanar circular orbits, and the synodic period set
//                     by the difference of their angular velocities.
//
// Every field is optional: the physics, the slider ranges and the drawing are
// fixed by the engine, and the config only chooses which mode the page opens
// in and where each period slider starts. The type guard below is the only
// validation, because `vizConfig.value` is an open record in velite.config.ts
// and a bad config would otherwise fail on the reader's screen.
export type RelativePeriodMode = "earth-day" | "planetary-orbits";

export const RELATIVE_PERIOD_MODES: readonly RelativePeriodMode[] = [
  "earth-day",
  "planetary-orbits",
];

export interface RelativePeriodSandboxConfig {
  mode?: RelativePeriodMode; // initial mode, default "earth-day"
  siderealRotationDays?: number; // earth-day: sidereal rotation period τ*
  earthOrbitPeriodDays?: number; // earth-day: Earth's sidereal orbital period P
  periodADays?: number; // planetary-orbits: sidereal period of body A
  periodBDays?: number; // planetary-orbits: sidereal period of body B
}

// Slider bounds, in days. Fixed by the engine, not configurable: the Earth-day
// ranges are what guarantee τ* < P (the largest τ* is 2 d, the smallest P is
// 10 d), so the mean-solar-day denominator can never reach zero or go
// negative.
export interface PeriodRange {
  min: number;
  max: number;
  step: number;
}

export const SIDEREAL_ROTATION_RANGE: PeriodRange = { min: 0.5, max: 2.0, step: 0.001 };
export const EARTH_ORBIT_PERIOD_RANGE: PeriodRange = { min: 10, max: 1000, step: 0.1 };
export const PERIOD_A_RANGE: PeriodRange = { min: 50, max: 5000, step: 0.1 };
export const PERIOD_B_RANGE: PeriodRange = { min: 50, max: 10000, step: 0.1 };

// Defaults: Earth's sidereal rotation and orbital periods (Karttunen et al.,
// Fundamental Astronomy, Table C.4) and the Earth–Jupiter pair.
export const DEFAULT_SIDEREAL_ROTATION_DAYS = 0.9972696723;
export const DEFAULT_EARTH_ORBIT_PERIOD_DAYS = 365.2564;
export const DEFAULT_PERIOD_A_DAYS = 365.2564;
export const DEFAULT_PERIOD_B_DAYS = 4330.6;
export const DEFAULT_MODE: RelativePeriodMode = "earth-day";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inRange(value: unknown, range: PeriodRange): boolean {
  return isFiniteNumber(value) && value >= range.min && value <= range.max;
}

export function modeOf(config: RelativePeriodSandboxConfig): RelativePeriodMode {
  return config.mode ?? DEFAULT_MODE;
}

export interface InitialPeriods {
  siderealRotationDays: number;
  earthOrbitPeriodDays: number;
  periodADays: number;
  periodBDays: number;
}

// The starting value of every slider, whichever mode is showing, because the
// reader can switch modes and each mode's sliders keep their own values.
export function initialPeriodsOf(config: RelativePeriodSandboxConfig): InitialPeriods {
  return {
    siderealRotationDays: config.siderealRotationDays ?? DEFAULT_SIDEREAL_ROTATION_DAYS,
    earthOrbitPeriodDays: config.earthOrbitPeriodDays ?? DEFAULT_EARTH_ORBIT_PERIOD_DAYS,
    periodADays: config.periodADays ?? DEFAULT_PERIOD_A_DAYS,
    periodBDays: config.periodBDays ?? DEFAULT_PERIOD_B_DAYS,
  };
}

export function isRelativePeriodSandboxConfig(
  config: unknown,
): config is RelativePeriodSandboxConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  const c = config as Record<string, unknown>;

  if (c.mode !== undefined && !RELATIVE_PERIOD_MODES.includes(c.mode as RelativePeriodMode)) {
    return false;
  }
  if (c.siderealRotationDays !== undefined && !inRange(c.siderealRotationDays, SIDEREAL_ROTATION_RANGE)) {
    return false;
  }
  if (c.earthOrbitPeriodDays !== undefined && !inRange(c.earthOrbitPeriodDays, EARTH_ORBIT_PERIOD_RANGE)) {
    return false;
  }
  if (c.periodADays !== undefined && !inRange(c.periodADays, PERIOD_A_RANGE)) return false;
  if (c.periodBDays !== undefined && !inRange(c.periodBDays, PERIOD_B_RANGE)) return false;
  return true;
}
