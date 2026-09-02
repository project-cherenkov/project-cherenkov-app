// Pure orbital-mechanics math for OrbitalSandbox, split out of ./index.tsx
// (a "use client" component) so it can be unit-tested directly and so
// index.tsx stays focused on React state, playback, and canvas rendering —
// mirroring trajectory-sandbox/physics-functions.ts's split.

// Kepler's equation M = E - e sin(E), solved for E via Newton–Raphson.
export function solveEccentricAnomaly(meanAnomaly: number, e: number): number {
  let E = meanAnomaly;
  for (let i = 0; i < 8; i++) {
    E = E - (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
  }
  return E;
}

export interface OrbitGeometry {
  a: number; // semi-major axis, px
  b: number; // semi-minor axis, px
  c: number; // center-to-focus distance, px (the star sits at this focus)
  meanMotion: number; // rad/s
}

// Derives the ellipse's on-canvas geometry from the config's schematic
// scale (semiMajorAxisPx) and the current eccentricity/period.
export function orbitGeometry(
  semiMajorAxisPx: number,
  eccentricity: number,
  periodSeconds: number,
): OrbitGeometry {
  const a = semiMajorAxisPx;
  const b = a * Math.sqrt(1 - eccentricity ** 2);
  const c = a * eccentricity;
  const meanMotion = (2 * Math.PI) / periodSeconds;
  return { a, b, c, meanMotion };
}

// Planet's position relative to the focus the star sits at.
export function planetOffsetAt(
  time: number,
  eccentricity: number,
  geometry: OrbitGeometry,
): { x: number; y: number } {
  const M = geometry.meanMotion * time;
  const E = solveEccentricAnomaly(M, eccentricity);
  return {
    x: geometry.a * Math.cos(E) - geometry.c,
    y: geometry.b * Math.sin(E),
  };
}

// Schematic angular half-width (in eccentric anomaly, radians) of the
// star's disc as seen from the planet at periapsis. Not derived from real
// stellar/planet radii — this sandbox doesn't model those — chosen so the
// transit dip is comfortably visible across the eccentricity range.
export const TRANSIT_ANGULAR_HALF_WIDTH = 0.22;

// Simplified transit model: assumes the transit is periapsis-aligned (a
// common simplifying convention in intro problems) and viewed edge-on.
// Real transit timing/duration also depends on argument of periapsis,
// impact parameter, and inclination — none of which this sandbox models.
// What IS physically real here: transit duration shrinking as eccentricity
// grows, because the planet moves fastest near periapsis (Kepler's second
// law) — dM/dE = 1 − e·cos(E).
export function transitHalfWidthSeconds(
  eccentricity: number,
  periodSeconds: number,
): number {
  return (
    (TRANSIT_ANGULAR_HALF_WIDTH * (1 - eccentricity) * periodSeconds) /
    (2 * Math.PI)
  );
}

// Normalized flux (1 = out of transit) at a given time in the orbit,
// given the precomputed transit half-width and the config's transit depth.
export function fluxAt(
  time: number,
  periodSeconds: number,
  halfWidthSeconds: number,
  transitDepth: number,
): number {
  const distToPeriapsis = Math.min(time, periodSeconds - time);
  if (distToPeriapsis > halfWidthSeconds) return 1;
  const x = distToPeriapsis / halfWidthSeconds;
  const dipShape = 0.5 * (1 + Math.cos(Math.PI * x)); // smooth ingress/egress
  return 1 - transitDepth * dipShape;
}
