import { describe, expect, it } from "vitest";

import {
  BOLTZMANN_K,
  PLANCK_H,
  SAMPLE_COUNT,
  SPEED_OF_LIGHT,
  WAVELENGTH_MAX_NM,
  WAVELENGTH_MIN_NM,
  X_DECADE_TICKS_NM,
  X_MAJOR_TICKS_NM,
  Y_FLOOR_LOG10,
  Y_MARGIN_DECADES,
  computeSpectrum,
  evaluateAt,
  exponentArgument,
  formatInteger,
  formatPowerOfTen,
  formatScientific,
  formatThreeSignificant,
  nmToM,
  planckFactor,
  planckPeakWavelengthNm,
  planckRadiance,
  rayleighJeansRadiance,
  rayleighJeansToPlanckRatio,
  wavelengthSamplesNm,
  xMinorGridNm,
  yAxisLimits,
  yDecades,
  yLabelStepDecades,
} from "./physics-functions";

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

// Section 11 of the visualization brief: direct evaluation of Equations
// (1)–(3) in double precision with the exact SI constants. The brief rounds
// to ten significant figures, so the comparison tolerance is 1e-8.
const BRIEF_ROWS = [
  { T: 6000, nm: 500, x: 4.795922925, planck: 3.175690666e13, rj: 7.947036621e14, ratio: 25.02459294 },
  { T: 6000, nm: 10_000, x: 0.2397961463, planck: 4.39515425e9, rj: 4.966897888e9, ratio: 1.130085 },
  { T: 6000, nm: 100_000, x: 0.02397961463, planck: 4.907583743e5, rj: 4.966897888e5, ratio: 1.012086222 },
  { T: 3000, nm: 100, x: 47.95922925, planck: 1.768067378e-2, rj: 2.483448944e17, ratio: 1.404612163e19 },
];

describe("constants", () => {
  it("are the exact SI values", () => {
    expect(PLANCK_H).toBe(6.62607015e-34);
    expect(SPEED_OF_LIGHT).toBe(299792458);
    expect(BOLTZMANN_K).toBe(1.380649e-23);
  });
});

describe("brief test values (Section 11)", () => {
  for (const row of BRIEF_ROWS) {
    describe(`${row.T} K at ${row.nm} nm`, () => {
      const lambdaM = nmToM(row.nm);
      it("x = hc / (λkT)", () => {
        expect(relativeError(exponentArgument(lambdaM, row.T), row.x)).toBeLessThan(1e-8);
      });
      it("Planck spectral radiance", () => {
        expect(relativeError(planckRadiance(lambdaM, row.T), row.planck)).toBeLessThan(1e-8);
      });
      it("Rayleigh–Jeans spectral radiance", () => {
        expect(relativeError(rayleighJeansRadiance(lambdaM, row.T), row.rj)).toBeLessThan(1e-8);
      });
      it("ratio (e^x − 1) / x, and it equals B_RJ / B_P", () => {
        const x = exponentArgument(lambdaM, row.T);
        expect(relativeError(rayleighJeansToPlanckRatio(x), row.ratio)).toBeLessThan(1e-8);
        const direct = rayleighJeansRadiance(lambdaM, row.T) / planckRadiance(lambdaM, row.T);
        expect(relativeError(direct, row.ratio)).toBeLessThan(1e-8);
      });
      it("evaluateAt reports all of them together", () => {
        const v = evaluateAt(row.nm, row.T);
        expect(v.wavelengthNm).toBe(row.nm);
        expect(relativeError(v.planck, row.planck)).toBeLessThan(1e-8);
        expect(relativeError(v.rayleighJeans, row.rj)).toBeLessThan(1e-8);
        expect(relativeError(v.ratio, row.ratio)).toBeLessThan(1e-8);
      });
    });
  }

  it("the edge-of-range row stays finite while RJ is many orders of magnitude larger", () => {
    const v = evaluateAt(100, 3000);
    expect(Number.isFinite(v.planck)).toBe(true);
    expect(v.planck).toBeGreaterThan(0);
    expect(Math.log10(v.rayleighJeans / v.planck)).toBeGreaterThan(19);
  });
});

describe("planckFactor", () => {
  it("is 1/(e^x − 1) with no cancellation for tiny x (expm1)", () => {
    // 1/(e^x − 1) = 1/x − 1/2 + x/12 … so at x = 1e-12 it is 1e12 − 0.5.
    expect(relativeError(planckFactor(1e-12), 1e12 - 0.5)).toBeLessThan(1e-14);
    // The naive form loses about four digits at the same point.
    const naive = 1 / (Math.exp(1e-12) - 1);
    expect(relativeError(naive, 1e12 - 0.5)).toBeGreaterThan(1e-6);
  });

  it("agrees with the naive formula where that is safe", () => {
    for (const x of [0.5, 1, 2, 10, 50]) {
      expect(relativeError(planckFactor(x), 1 / (Math.exp(x) - 1))).toBeLessThan(1e-12);
    }
  });

  it("does not overflow for large x (e^x would be Infinity near x = 710)", () => {
    expect(Number.isFinite(planckFactor(700))).toBe(true);
    expect(planckFactor(700)).toBeGreaterThan(0);
    expect(planckFactor(1000)).toBe(0); // underflows to zero, never NaN or Infinity
  });

  it("is NaN for x ≤ 0 or NaN (outside the physics)", () => {
    expect(Number.isNaN(planckFactor(0))).toBe(true);
    expect(Number.isNaN(planckFactor(-1))).toBe(true);
    expect(Number.isNaN(planckFactor(Number.NaN))).toBe(true);
  });
});

describe("limits of the two laws", () => {
  it("Planck → Rayleigh–Jeans as x → 0 (long wavelength)", () => {
    const ratio = rayleighJeansToPlanckRatio(1e-6);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio - 1).toBeLessThan(1e-5);
  });

  it("the ratio grows without bound as x grows (short wavelength)", () => {
    expect(rayleighJeansToPlanckRatio(10)).toBeGreaterThan(rayleighJeansToPlanckRatio(5));
    expect(rayleighJeansToPlanckRatio(30)).toBeGreaterThan(1e11);
  });

  it("the ratio overflows to Infinity (reported as out of range), not NaN", () => {
    expect(rayleighJeansToPlanckRatio(800)).toBe(Infinity);
  });

  it("Rayleigh–Jeans scales as λ^-4 and as T", () => {
    const a = rayleighJeansRadiance(nmToM(1000), 6000);
    expect(relativeError(rayleighJeansRadiance(nmToM(500), 6000), a * 16)).toBeLessThan(1e-12);
    expect(relativeError(rayleighJeansRadiance(nmToM(1000), 12000), a * 2)).toBeLessThan(1e-12);
  });
});

describe("Planck peak (Equation 4)", () => {
  it("is b / T in nanometres: 6000 K peaks near 483 nm", () => {
    expect(planckPeakWavelengthNm(6000)).toBeCloseTo(482.9667, 3);
    expect(Math.round(planckPeakWavelengthNm(6000))).toBe(483);
  });

  it("is inside the display window at every slider temperature", () => {
    for (let T = 3000; T <= 12000; T += 250) {
      const peak = planckPeakWavelengthNm(T);
      expect(peak).toBeGreaterThan(WAVELENGTH_MIN_NM);
      expect(peak).toBeLessThan(WAVELENGTH_MAX_NM);
    }
  });

  it("really is the maximum of B_λ (Wien's constant is rounded, so allow ±0.1%)", () => {
    for (const T of [3000, 6000, 12000]) {
      const peakNm = planckPeakWavelengthNm(T);
      const at = (nm: number) => planckRadiance(nmToM(nm), T);
      expect(at(peakNm)).toBeGreaterThan(at(peakNm * 0.9));
      expect(at(peakNm)).toBeGreaterThan(at(peakNm * 1.1));
      const best = Math.max(...Array.from({ length: 2001 }, (_, i) => at(peakNm * (0.5 + i / 2000))));
      expect(relativeError(at(peakNm), best)).toBeLessThan(1e-3);
    }
  });
});

describe("wavelength samples", () => {
  const samples = wavelengthSamplesNm();

  it("are 400 logarithmically spaced values from 100 nm to 100,000 nm inclusive", () => {
    expect(samples).toHaveLength(400);
    expect(SAMPLE_COUNT).toBe(400);
    expect(samples[0]).toBe(100);
    expect(samples[399]).toBe(100_000);
  });

  it("follow λ_j = 100 · 1000^(j/399)", () => {
    for (const j of [1, 57, 199, 398]) {
      expect(relativeError(samples[j]!, 100 * 1000 ** (j / 399))).toBeLessThan(1e-12);
    }
  });

  it("have a constant ratio between neighbours (log spacing, not linear)", () => {
    const ratio = samples[1]! / samples[0]!;
    for (let j = 1; j < samples.length; j++) {
      expect(relativeError(samples[j]! / samples[j - 1]!, ratio)).toBeLessThan(1e-12);
    }
  });

  it("never include zero", () => {
    expect(Math.min(...samples)).toBeGreaterThan(0);
  });
});

describe("computeSpectrum", () => {
  it("is finite and positive over the whole slider range, so nothing is omitted", () => {
    for (let T = 3000; T <= 12000; T += 250) {
      const s = computeSpectrum(T);
      expect(s.hasOmittedValues, `${T} K`).toBe(false);
      expect(s.planck.every((v) => v !== null && v > 0 && Number.isFinite(v))).toBe(true);
      expect(s.rayleighJeans.every((v) => v !== null && v > 0 && Number.isFinite(v))).toBe(true);
    }
  });

  it("Rayleigh–Jeans falls monotonically with wavelength; Planck rises then falls", () => {
    const s = computeSpectrum(6000);
    const rj = s.rayleighJeans as number[];
    for (let i = 1; i < rj.length; i++) expect(rj[i]!).toBeLessThan(rj[i - 1]!);
    const planck = s.planck as number[];
    const top = planck.indexOf(Math.max(...planck));
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(planck.length - 1);
  });

  it("the two curves meet at long wavelength and separate at short wavelength", () => {
    const s = computeSpectrum(6000);
    const first = (s.rayleighJeans[0] as number) / (s.planck[0] as number);
    const last = (s.rayleighJeans[399] as number) / (s.planck[399] as number);
    expect(last).toBeLessThan(1.02);
    expect(first).toBeGreaterThan(1e6);
  });

  it("omits (null) a sample that underflows to zero instead of passing it to a log axis", () => {
    // 50 K is outside the slider; it is a stand-in for a future expanded range.
    const s = computeSpectrum(50);
    expect(s.planck[0]).toBeNull();
    expect(s.hasOmittedValues).toBe(true);
    expect(s.planck.some((v) => v !== null)).toBe(true);
    expect(s.planck.every((v) => v === null || (v > 0 && Number.isFinite(v)))).toBe(true);
  });
});

describe("yAxisLimits", () => {
  it("spans both curves plus 0.5 decades of padding at each end", () => {
    const s = computeSpectrum(6000);
    const all = [...s.planck, ...s.rayleighJeans] as number[];
    const limits = yAxisLimits(s);
    expect(limits.minLog10).toBeCloseTo(Math.log10(Math.min(...all)) - Y_MARGIN_DECADES, 10);
    expect(limits.maxLog10).toBeCloseTo(Math.log10(Math.max(...all)) + Y_MARGIN_DECADES, 10);
  });

  it("depends only on the temperature, never on which curve is drawn", () => {
    // The function has no mode argument; pin that the range covers the curve
    // that is NOT the minimum or the maximum too.
    const s = computeSpectrum(6000);
    const limits = yAxisLimits(s);
    for (const v of [...s.planck, ...s.rayleighJeans] as number[]) {
      expect(Math.log10(v)).toBeGreaterThan(limits.minLog10);
      expect(Math.log10(v)).toBeLessThan(limits.maxLog10);
    }
  });

  it("clamps the lower limit to a representable value on underflow", () => {
    const s = { wavelengthsNm: [1], planck: [1e-320], rayleighJeans: [1], hasOmittedValues: false };
    expect(yAxisLimits(s).minLog10).toBe(Y_FLOOR_LOG10);
  });

  it("falls back to a harmless window when nothing is positive", () => {
    const limits = yAxisLimits({ wavelengthsNm: [1, 2], planck: [null, null], rayleighJeans: [null, null], hasOmittedValues: true });
    expect(limits.minLog10).toBeLessThan(limits.maxLog10);
    expect(Number.isFinite(limits.minLog10) && Number.isFinite(limits.maxLog10)).toBe(true);
  });

  it("moves with temperature (hotter means a taller range)", () => {
    expect(yAxisLimits(computeSpectrum(12000)).maxLog10).toBeGreaterThan(
      yAxisLimits(computeSpectrum(3000)).maxLog10,
    );
  });
});

describe("axis ticks", () => {
  it("x major labels are the ten values from the brief", () => {
    expect([...X_MAJOR_TICKS_NM]).toEqual([100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]);
    expect([...X_DECADE_TICKS_NM]).toEqual([100, 1000, 10000, 100000]);
  });

  it("minor x grid is 2..9 × 10^d inside the window", () => {
    const minor = xMinorGridNm();
    expect(minor).toContain(200);
    expect(minor).toContain(900);
    expect(minor).toContain(9000);
    expect(minor).toContain(90000);
    expect(minor).not.toContain(100);
    expect(minor).not.toContain(100_000);
    expect(Math.max(...minor)).toBeLessThan(WAVELENGTH_MAX_NM);
  });

  it("y decades are the integer exponents inside the range", () => {
    expect(yDecades({ minLog10: 5.5, maxLog10: 8.5 })).toEqual([6, 7, 8]);
    expect(yDecades({ minLog10: -3.2, maxLog10: -0.9 })).toEqual([-3, -2, -1]);
  });

  it("thins y labels: every decade when tall, every 5 or 10 on a 60-decade axis", () => {
    expect(yLabelStepDecades(40, 30)).toBe(1);
    expect(yLabelStepDecades(8.4, 30)).toBe(5);
    expect(yLabelStepDecades(8.4, 80)).toBe(10);
    expect(yLabelStepDecades(0.01, 30)).toBe(100);
  });
});

describe("number formatting", () => {
  it("scientific notation, three significant figures, in caret form", () => {
    expect(formatScientific(3.175690666e13)).toBe("3.18 × 10^13");
    expect(formatScientific(25.02459294)).toBe("2.50 × 10^1");
    expect(formatScientific(1.768067378e-2)).toBe("1.77 × 10^-2");
    expect(formatScientific(1)).toBe("1.00 × 10^0");
  });

  it("returns null for values that cannot be shown", () => {
    expect(formatScientific(Infinity)).toBeNull();
    expect(formatScientific(Number.NaN)).toBeNull();
  });

  it("y tick labels are powers of ten", () => {
    expect(formatPowerOfTen(13)).toBe("10^13");
    expect(formatPowerOfTen(-40)).toBe("10^-40");
  });

  it("three significant figures for the cursor wavelength", () => {
    expect(formatThreeSignificant(1234.5)).toBe("1,230");
    expect(formatThreeSignificant(482.97)).toBe("483");
    expect(formatThreeSignificant(100)).toBe("100");
    expect(formatThreeSignificant(Number.NaN)).toBe("");
  });

  it("integers are rounded to the nearest whole number, grouped by locale", () => {
    expect(formatInteger(482.9667)).toBe("483");
    expect(formatInteger(100000)).toBe("100,000");
    expect(formatInteger(100000, "id")).toBe("100.000");
  });
});
