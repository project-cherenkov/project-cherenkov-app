import { PHYSICS_FUNCTIONS, PHYSICS_TYPE_KEYS } from "./physics-functions";

// Same constraint as graph-array-stepper: frontmatter can't hold real
// executable functions. "a per-problem physics function supplied via
// vizConfig" (spec §7) is implemented as a small named registry in
// physics-functions.ts — vizConfig picks a function by key (`physicsType`)
// and supplies its parameters. Adding a new physics scenario means adding
// one entry to that registry, not touching any editorial content.
export interface TrajectorySandboxConfig {
  physicsType: "projectile";
  gravity: number; // m/s^2
  initial: {
    speed: number; // m/s — slider-adjustable starting value
    angleDeg: number; // degrees — slider-adjustable starting value
  };
  speedRange?: [number, number];
  angleRange?: [number, number];
  /**
   * R3 (docs/design/visualization-interactions.md): optional predict -> act ->
   * check problem layered on the sandbox. Purely additive: a config without
   * it behaves exactly as before. See isTrajectorySandboxConfig for the
   * "guaranteed solvable" rule.
   */
  challenge?: TrajectorySandboxChallenge;
}

export interface TrajectorySandboxChallenge {
  /** Markdown + KaTeX, rendered with MarkdownText. */
  prompt: string;
  /** Land within `toleranceM` of `rangeM` (metres, measured along the ground). */
  target: { rangeM: number; toleranceM: number };
  /** Markdown + KaTeX; shown after two failed attempts. */
  hint?: string;
  /** Markdown + KaTeX; shown on success. */
  successNote?: string;
}

// Slider defaults and increments, shared by index.tsx (the sliders and the
// drag handle) and the challenge solvability check below, so "what the
// reader can actually select" has exactly one definition. Previously these
// numbers were inline in index.tsx; the values are unchanged.
export const DEFAULT_SPEED_RANGE: [number, number] = [5, 40];
export const DEFAULT_ANGLE_RANGE: [number, number] = [5, 85];
export const SPEED_STEP = 1;
export const ANGLE_STEP = 1;

export function speedRangeOf(config: Pick<TrajectorySandboxConfig, "speedRange">): [number, number] {
  return config.speedRange ?? DEFAULT_SPEED_RANGE;
}

export function angleRangeOf(config: Pick<TrajectorySandboxConfig, "angleRange">): [number, number] {
  return config.angleRange ?? DEFAULT_ANGLE_RANGE;
}

// Where a flight lands (x at the end of flightTime). Used both by the
// component, to judge an attempt, and by the guard, to decide whether a
// challenge can be won — one function, so the two can never disagree.
export function landingRange(
  physicsType: string,
  initial: { speed: number; angleDeg: number },
  gravity: number,
): number {
  const physics = PHYSICS_FUNCTIONS[physicsType]!;
  return physics.position(physics.flightTime(initial, gravity), initial, gravity).x;
}

// Upper bound on speed settings the solvability search will enumerate. Real
// ranges are tens of values; this only stops a pathological speedRange such
// as [1, 1e9] from hanging the guard.
const MAX_SPEED_SETTINGS = 5000;

// Values the sliders can actually produce: min, min + step, ... <= max.
// (Radix steps from `min`, so a non-integer min gives non-integer settings.)
function settings(range: [number, number], step: number): number[] {
  const out: number[] = [];
  for (let i = 0; range[0] + i * step <= range[1] + 1e-9; i++) {
    out.push(range[0] + i * step);
  }
  return out;
}

// "Guaranteed solvable": some (speed, angle) the reader can really select
// must land within tolerance. Checked on the slider grid, not the continuous
// range, because the sliders and the drag handle both snap to steps — a
// target that is reachable only between two notches could never be hit.
function isChallengeSolvable(
  // physicsType is a plain string here: the guard has just checked it is a
  // registered key, but TypeScript can't know that from `unknown` input.
  c: Pick<TrajectorySandboxConfig, "gravity" | "speedRange" | "angleRange"> & {
    physicsType: string;
  },
  target: { rangeM: number; toleranceM: number },
): boolean {
  const speedRange = speedRangeOf(c);
  if ((speedRange[1] - speedRange[0]) / SPEED_STEP > MAX_SPEED_SETTINGS) return false;
  const speeds = settings(speedRange, SPEED_STEP);
  const angles = settings(angleRangeOf(c), ANGLE_STEP);
  for (const speed of speeds) {
    for (const angleDeg of angles) {
      const landing = landingRange(c.physicsType, { speed, angleDeg }, c.gravity);
      if (Math.abs(landing - target.rangeM) <= target.toleranceM) return true;
    }
  }
  return false;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isChallengeShape(value: unknown): value is TrajectorySandboxChallenge {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.prompt !== "string" || c.prompt.trim() === "") return false;
  if (c.hint !== undefined && typeof c.hint !== "string") return false;
  if (c.successNote !== undefined && typeof c.successNote !== "string") return false;
  const target = c.target;
  if (typeof target !== "object" || target === null || Array.isArray(target)) return false;
  const t = target as Record<string, unknown>;
  return isPositiveFinite(t.rangeM) && isPositiveFinite(t.toleranceM);
}

// TICKET-02 (ARCH-001): physicsType must be a *registered* key, not just a
// string — an unrecognized value used to pass this guard and then crash
// TrajectorySandbox's non-null registry lookup at render time. TICKET-03
// (ROBUST-001): gravity must be positive — index.tsx divides by it in
// flightTime, so zero/negative values would produce Infinity/NaN/negative
// flight times instead of a caught config error.
export function isTrajectorySandboxConfig(
  config: unknown,
): config is TrajectorySandboxConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  const initial = c.initial;
  const initialRecord =
    typeof initial === "object" && initial !== null
      ? (initial as Record<string, unknown>)
      : null;
  const speed = initialRecord?.speed;
  const angleDeg = initialRecord?.angleDeg;
  const isRange = (value: unknown): value is [number, number] =>
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((bound) => typeof bound === "number" && Number.isFinite(bound)) &&
    value[0] <= value[1];
  const baseValid =
    typeof c.physicsType === "string" &&
    PHYSICS_TYPE_KEYS.includes(c.physicsType) &&
    typeof c.gravity === "number" &&
    Number.isFinite(c.gravity) &&
    c.gravity > 0 &&
    typeof speed === "number" &&
    Number.isFinite(speed) &&
    speed > 0 &&
    typeof angleDeg === "number" &&
    Number.isFinite(angleDeg) &&
    angleDeg >= 0 &&
    angleDeg <= 90 &&
    (c.speedRange === undefined ||
      (isRange(c.speedRange) && c.speedRange[0] > 0)) &&
    (c.angleRange === undefined ||
      (isRange(c.angleRange) &&
        c.angleRange[0] >= 0 &&
        c.angleRange[1] <= 90));
  if (!baseValid) return false;

  // R3: an absent challenge changes nothing, so every pre-existing config
  // validates exactly as it did. A present one must be well-formed AND
  // winnable with the sliders the reader is given, so a published editorial
  // can never contain an impossible problem.
  if (c.challenge === undefined) return true;
  if (!isChallengeShape(c.challenge)) return false;
  return isChallengeSolvable(
    {
      physicsType: c.physicsType as string,
      gravity: c.gravity as number,
      speedRange: c.speedRange as [number, number] | undefined,
      angleRange: c.angleRange as [number, number] | undefined,
    },
    c.challenge.target,
  );
}
