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

export function isOrbitalSandboxConfig(
  config: unknown,
): config is OrbitalSandboxConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c.eccentricity === "number" &&
    typeof c.semiMajorAxisPx === "number" &&
    typeof c.periodSeconds === "number"
  );
}
