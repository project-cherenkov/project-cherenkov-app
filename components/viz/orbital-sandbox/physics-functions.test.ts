import { describe, expect, it } from "vitest";
import {
  fluxAt,
  orbitGeometry,
  planetOffsetAt,
  solveEccentricAnomaly,
  transitHalfWidthSeconds,
} from "./physics-functions";

describe("solveEccentricAnomaly", () => {
  it("returns E = M for a circular orbit (e = 0)", () => {
    // Kepler's equation M = E - e·sin(E) collapses to M = E when e = 0.
    expect(solveEccentricAnomaly(1.2, 0)).toBeCloseTo(1.2, 10);
  });

  it("satisfies Kepler's equation for an eccentric orbit", () => {
    const meanAnomaly = 2.1;
    const e = 0.6;
    const E = solveEccentricAnomaly(meanAnomaly, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(meanAnomaly, 8);
  });
});

describe("orbitGeometry", () => {
  it("is a circle when eccentricity is 0 (b = a, c = 0)", () => {
    const { a, b, c } = orbitGeometry(100, 0, 6);
    expect(b).toBeCloseTo(a, 10);
    expect(c).toBe(0);
  });

  it("derives b, c, and meanMotion from semi-major axis / eccentricity / period", () => {
    const geometry = orbitGeometry(100, 0.6, 6);
    expect(geometry.a).toBe(100);
    expect(geometry.b).toBeCloseTo(100 * Math.sqrt(1 - 0.6 ** 2), 10);
    expect(geometry.c).toBeCloseTo(60, 10);
    expect(geometry.meanMotion).toBeCloseTo((2 * Math.PI) / 6, 10);
  });
});

describe("planetOffsetAt", () => {
  it("places the planet at periapsis (a - c, 0) at t = 0", () => {
    const geometry = orbitGeometry(100, 0.6, 6);
    const offset = planetOffsetAt(0, 0.6, geometry);
    expect(offset.x).toBeCloseTo(geometry.a - geometry.c, 8);
    expect(offset.y).toBeCloseTo(0, 8);
  });
});

describe("transitHalfWidthSeconds", () => {
  it("shrinks as eccentricity increases (transit duration shrinks near periapsis)", () => {
    const circular = transitHalfWidthSeconds(0, 6);
    const eccentric = transitHalfWidthSeconds(0.6, 6);
    expect(eccentric).toBeLessThan(circular);
  });
});

describe("fluxAt", () => {
  it("is unaffected (flux = 1) far from periapsis, outside the transit window", () => {
    expect(fluxAt(3, 6, 0.1, 0.01)).toBe(1);
  });

  it("dips to the full transit depth exactly at periapsis", () => {
    expect(fluxAt(0, 6, 0.1, 0.01)).toBeCloseTo(1 - 0.01, 10);
  });
});
