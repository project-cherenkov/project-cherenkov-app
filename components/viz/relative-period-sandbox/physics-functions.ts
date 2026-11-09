// The model behind the `relative-period-sandbox` engine. Closed-form
// evaluation only: no iteration, no solver, and nothing is rounded until it is
// displayed. Periods are in days, angular rates in radians per day, angles in
// radians and measured counterclockwise in the mathematical orbital plane.
//
// Exact within the model: constant mean angular velocities, circular coplanar
// orbits, a fixed distant-star reference, prograde rotation. Eccentricity,
// inclination, perturbations, precession, nutation and the equation of time
// are not modelled.
export const TWO_PI = 2 * Math.PI;

// One synodic recurrence takes this long at 1× speed.
export const CYCLE_SECONDS = 12;
// Playback position `u` runs 0..1 and the shared scrubber works in whole
// hundredths of it.
export const PHASE_STEPS = 100;
export const PHASE_STEP = 1 / PHASE_STEPS;

export const SECONDS_PER_DAY = 86400;

// Angles snap to zero this close to a full turn, so a configuration that has
// exactly repeated reads 0.0°, not 360.0°, despite floating-point error.
const WRAP_EPSILON = 1e-9;

export function wrapAngle(theta: number): number {
  const wrapped = ((theta % TWO_PI) + TWO_PI) % TWO_PI;
  return TWO_PI - wrapped < WRAP_EPSILON ? 0 : wrapped;
}

export const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;

// Prograde motion appears counterclockwise on screen, so y is flipped:
// x = cx + r cos θ, y = cy − r sin θ.
export function polarToCanvas(
  cx: number,
  cy: number,
  radius: number,
  theta: number,
): { x: number; y: number } {
  return { x: cx + radius * Math.cos(theta), y: cy - radius * Math.sin(theta) };
}

export const clampPhase = (u: number) => Math.min(Math.max(u, 0), 1);

// Playback never loops: the relative configuration repeats at u = 1 but the
// absolute longitudes do not, so wrapping would visibly jump.
export function advancePhase(u: number, elapsedSeconds: number): number {
  return clampPhase(u + elapsedSeconds / CYCLE_SECONDS);
}

// ---------------------------------------------------------------- Earth's day

export interface EarthDayParams {
  siderealRotationDays: number; // τ*
  earthOrbitPeriodDays: number; // P
}

// (6) τ = 1 / (1/τ* − 1/P). Null when the denominator is not positive, which
// the slider ranges make unreachable (τ* ≤ 2 d < 10 d ≤ P).
export function meanSolarDayDays(p: EarthDayParams): number | null {
  const rate = 1 / p.siderealRotationDays - 1 / p.earthOrbitPeriodDays;
  return rate > 0 ? 1 / rate : null;
}

export interface EarthDayState {
  timeDays: number;
  meanSolarDayDays: number;
  // Fraction of the cycle at which the marked meridian is back on the fixed
  // star direction: τ*/τ. The solar return is at 1.
  siderealReturnPhase: number;
  orbitAngle: number; // Earth's position on its orbit, 2πt/P, unwrapped
  meridianAngle: number; // θ_meridian, unwrapped
  sunAngle: number; // θ_sun in the inertial dial, unwrapped
  starAngle: number; // fixed
  meridianToSun: number; // (5) wrapped to [0, 2π)
  meridianToStar: number; // wrapped to [0, 2π)
  orbitalAdvanceDegrees: number; // 360° / P × τ
}

// At t = 0 the meridian, the Sun direction and the star reference all point
// the same way: left, π. Earth starts on the right of the Sun (orbital angle
// 0), so the direction from Earth to the Sun really is π.
export const INITIAL_DIRECTION = Math.PI;

export function earthDayState(p: EarthDayParams, u: number): EarthDayState | null {
  const tau = meanSolarDayDays(p);
  if (tau === null) return null;
  const phase = clampPhase(u);
  const t = phase * tau; // one cycle is one mean solar day
  const omegaStar = TWO_PI / p.siderealRotationDays; // (1)
  const omegaOrb = TWO_PI / p.earthOrbitPeriodDays; // (2)
  const meridianAngle = INITIAL_DIRECTION + omegaStar * t; // (3)
  const sunAngle = INITIAL_DIRECTION + omegaOrb * t; // (4)
  return {
    timeDays: t,
    meanSolarDayDays: tau,
    siderealReturnPhase: p.siderealRotationDays / tau,
    orbitAngle: omegaOrb * t,
    meridianAngle,
    sunAngle,
    starAngle: INITIAL_DIRECTION,
    meridianToSun: wrapAngle(meridianAngle - sunAngle),
    meridianToStar: wrapAngle(meridianAngle - INITIAL_DIRECTION),
    orbitalAdvanceDegrees: (360 / p.earthOrbitPeriodDays) * tau,
  };
}

// ------------------------------------------------------------ Planetary orbits

export interface PlanetaryParams {
  periodADays: number;
  periodBDays: number;
}

// (12) S = 1 / |1/P_A − 1/P_B|. Null when the periods are equal: the relative
// angular velocity is zero and no finite recurrence interval exists.
export function synodicPeriodDays(p: PlanetaryParams): number | null {
  const rate = Math.abs(1 / p.periodADays - 1 / p.periodBDays);
  return rate === 0 ? null : 1 / rate;
}

export interface PlanetaryState {
  cycleAvailable: boolean;
  synodicPeriodDays: number | null;
  timeDays: number;
  longitudeA: number; // θ_A, unwrapped
  longitudeB: number; // θ_B, unwrapped
  relativeAngle: number; // (11) wrapped to [0, 2π)
}

// With no finite synodic period there is no cycle to advance, so the bodies
// stay at their starting longitudes (both zero).
export function planetaryState(p: PlanetaryParams, u: number): PlanetaryState {
  const synodic = synodicPeriodDays(p);
  if (synodic === null) {
    return {
      cycleAvailable: false,
      synodicPeriodDays: null,
      timeDays: 0,
      longitudeA: 0,
      longitudeB: 0,
      relativeAngle: 0,
    };
  }
  const t = clampPhase(u) * synodic;
  const longitudeA = (TWO_PI / p.periodADays) * t; // (7), (9)
  const longitudeB = (TWO_PI / p.periodBDays) * t; // (8), (10)
  return {
    cycleAvailable: true,
    synodicPeriodDays: synodic,
    timeDays: t,
    longitudeA,
    longitudeB,
    relativeAngle: wrapAngle(longitudeA - longitudeB),
  };
}

// -------------------------------------------------------------------- Display

// Locale-aware, and rounds only here.
export function formatFixed(value: number, decimals: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatSignificant(value: number, digits: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: digits }).format(value);
}

// Days to "23 h 56 min 4.1 s", to the nearest 0.1 s. Rounding is done once, on
// the whole interval in tenths of a second, so 59.96 s carries into the next
// minute instead of reading "60.0 s".
export function formatHms(days: number, locale: string): string {
  const tenths = Math.round(days * SECONDS_PER_DAY * 10);
  const hours = Math.floor(tenths / 36000);
  const minutes = Math.floor((tenths % 36000) / 600);
  const seconds = (tenths % 600) / 10;
  return `${hours} h ${minutes} min ${formatFixed(seconds, 1, locale)} s`;
}
