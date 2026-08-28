import { PHYSICS_TYPE_KEYS } from "./physics-functions";

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
  return (
    typeof c.physicsType === "string" &&
    PHYSICS_TYPE_KEYS.includes(c.physicsType) &&
    typeof c.gravity === "number" &&
    c.gravity > 0
  );
}
