// Same constraint as graph-array-stepper: frontmatter can't hold real
// executable functions. "a per-problem physics function supplied via
// vizConfig" (spec §7) is implemented as a small named registry in
// index.tsx — vizConfig picks a function by key (`physicsType`) and
// supplies its parameters. Adding a new physics scenario means adding one
// entry to that registry, not touching any editorial content.
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

export function isTrajectorySandboxConfig(
  config: unknown,
): config is TrajectorySandboxConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  return typeof c.physicsType === "string" && typeof c.gravity === "number";
}
