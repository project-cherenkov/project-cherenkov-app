export interface OrbitalSandboxConfig {
  eccentricity: number; // 0 (circular) .. <1
  semiMajorAxisPx: number; // visual orbit scale — this is a schematic
  // sandbox, not a physically-scaled simulation, so this is pixels, not AU.
  periodSeconds: number; // how long one full orbit takes when played back
  massRatio?: number; // planet/star mass ratio, default 0.05 — drives the
  // star's reflex wobble around the barycenter
  transitDepth?: number; // fractional flux drop at mid-transit, default 0.01
  eccentricityRange?: [number, number];
  massRatioRange?: [number, number];
}

// TICKET-03 (ROBUST-001): range checks alongside the existing type checks.
// eccentricity >= 1 makes solveEccentricAnomaly's Newton-Raphson step divide
// by (1 - e*cos(E)), which is exactly 0 at E=0 when e=1 — a real 0/0 in the
// elliptical-orbit math this component implements (e>=1 is a parabolic or
// hyperbolic trajectory, a genuinely different equation this sandbox
// doesn't model). semiMajorAxisPx/periodSeconds must be positive — both are
// divisors or scale factors elsewhere in index.tsx. massRatio, when
// present, must be non-negative (a negative mass ratio has no physical
// meaning here).
export function isOrbitalSandboxConfig(
  config: unknown,
): config is OrbitalSandboxConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  if (
    typeof c.eccentricity !== "number" ||
    c.eccentricity < 0 ||
    c.eccentricity >= 1
  ) {
    return false;
  }
  if (typeof c.semiMajorAxisPx !== "number" || c.semiMajorAxisPx <= 0) {
    return false;
  }
  if (typeof c.periodSeconds !== "number" || c.periodSeconds <= 0) {
    return false;
  }
  if (c.massRatio !== undefined) {
    if (typeof c.massRatio !== "number" || c.massRatio < 0) return false;
  }
  return true;
}
