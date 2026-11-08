// The maths behind the blackbody-spectrum-comparison engine. Pure functions
// only (no DOM, no React), so each equation is unit-tested against the values
// in the visualization brief. Everything is the wavelength form, B_λ, in SI:
// W m^-3 sr^-1.

// SI constants (exact, 2019 redefinition) and the rounded Wien constant used
// by Fundamental Astronomy.
export const PLANCK_H = 6.62607015e-34; // J s
export const SPEED_OF_LIGHT = 299792458; // m s^-1
export const BOLTZMANN_K = 1.380649e-23; // J K^-1
export const WIEN_B = 2.8978e-3; // m K

// The display window. It is a finite window on purpose: it never contains
// λ = 0, so nothing in this file can divide by zero.
export const WAVELENGTH_MIN_NM = 100;
export const WAVELENGTH_MAX_NM = 100_000;
export const SAMPLE_COUNT = 400;
export const Y_MARGIN_DECADES = 0.5;
// log10 of the smallest value the y-axis may reach. Planck's law can
// underflow far below this at extreme settings; clamping keeps the axis
// finite and representable.
export const Y_FLOOR_LOG10 = -300;

const NM_TO_M = 1e-9;

// Equation (1): x = hc / (λkT). Wavelength in metres, temperature in kelvin.
export function exponentArgument(wavelengthM: number, temperatureK: number): number {
  return (PLANCK_H * SPEED_OF_LIGHT) / (wavelengthM * BOLTZMANN_K * temperatureK);
}

// 1 / (e^x − 1), evaluated without overflow or cancellation:
//   small x: expm1 keeps full precision where e^x − 1 would lose digits;
//   large x: e^x overflows near x ≈ 709, so use e^−x / (1 − e^−x) instead.
export function planckFactor(x: number): number {
  if (!(x > 0)) return Number.NaN;
  if (x < 1) return 1 / Math.expm1(x);
  const decay = Math.exp(-x);
  return decay / (1 - decay);
}

// Equation (2): Planck spectral radiance per unit wavelength.
export function planckRadiance(wavelengthM: number, temperatureK: number): number {
  const x = exponentArgument(wavelengthM, temperatureK);
  return (
    ((2 * PLANCK_H * SPEED_OF_LIGHT ** 2) / wavelengthM ** 5) * planckFactor(x)
  );
}

// Equation (3): Rayleigh–Jeans spectral radiance per unit wavelength.
export function rayleighJeansRadiance(wavelengthM: number, temperatureK: number): number {
  return (2 * SPEED_OF_LIGHT * BOLTZMANN_K * temperatureK) / wavelengthM ** 4;
}

// Equation (4): the Planck peak per unit wavelength, in nanometres.
export function planckPeakWavelengthNm(temperatureK: number): number {
  return (WIEN_B / temperatureK) / NM_TO_M;
}

// Equation (5): B_RJ / B_P = (e^x − 1) / x. Infinity once e^x overflows,
// which the caller reports as outside the display range.
export function rayleighJeansToPlanckRatio(x: number): number {
  if (!(x > 0)) return Number.NaN;
  if (x < 1) return Math.expm1(x) / x;
  return (Math.exp(x) - 1) / x;
}

export function nmToM(wavelengthNm: number): number {
  return wavelengthNm * NM_TO_M;
}

export interface CursorValues {
  wavelengthNm: number;
  x: number;
  planck: number;
  rayleighJeans: number;
  ratio: number;
}

// Both models at one wavelength, always both, whichever curve is drawn.
export function evaluateAt(wavelengthNm: number, temperatureK: number): CursorValues {
  const wavelengthM = nmToM(wavelengthNm);
  const x = exponentArgument(wavelengthM, temperatureK);
  return {
    wavelengthNm,
    x,
    planck: planckRadiance(wavelengthM, temperatureK),
    rayleighJeans: rayleighJeansRadiance(wavelengthM, temperatureK),
    ratio: rayleighJeansToPlanckRatio(x),
  };
}

// λ_j = 100 · 1000^(j/399): logarithmically spaced, both ends included.
export function wavelengthSamplesNm(count: number = SAMPLE_COUNT): number[] {
  const ratio = WAVELENGTH_MAX_NM / WAVELENGTH_MIN_NM;
  return Array.from({ length: count }, (_, j) => WAVELENGTH_MIN_NM * ratio ** (j / (count - 1)));
}

export interface Spectrum {
  wavelengthsNm: number[];
  // null where a value is zero or not finite: such a sample cannot sit on a
  // log axis and is left out of the line rather than invented.
  planck: (number | null)[];
  rayleighJeans: (number | null)[];
  hasOmittedValues: boolean;
}

function positiveFiniteOrNull(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function computeSpectrum(temperatureK: number): Spectrum {
  const wavelengthsNm = wavelengthSamplesNm();
  const planck = wavelengthsNm.map((nm) =>
    positiveFiniteOrNull(planckRadiance(nmToM(nm), temperatureK)),
  );
  const rayleighJeans = wavelengthsNm.map((nm) =>
    positiveFiniteOrNull(rayleighJeansRadiance(nmToM(nm), temperatureK)),
  );
  return {
    wavelengthsNm,
    planck,
    rayleighJeans,
    hasOmittedValues: planck.includes(null) || rayleighJeans.includes(null),
  };
}

export interface YAxisLimits {
  minLog10: number;
  maxLog10: number;
}

// Common y limits from BOTH curves, never just the visible one, so switching
// the mode never rescales the axis. 0.5 decades of padding at each end.
export function yAxisLimits(spectrum: Spectrum): YAxisLimits {
  let minLog = Number.POSITIVE_INFINITY;
  let maxLog = Number.NEGATIVE_INFINITY;
  for (const series of [spectrum.planck, spectrum.rayleighJeans]) {
    for (const value of series) {
      if (value === null) continue;
      const log = Math.log10(value);
      if (log < minLog) minLog = log;
      if (log > maxLog) maxLog = log;
    }
  }
  if (!Number.isFinite(minLog) || !Number.isFinite(maxLog)) {
    // Nothing positive to plot at all: a harmless placeholder window.
    return { minLog10: -1, maxLog10: 1 };
  }
  return {
    minLog10: Math.max(minLog - Y_MARGIN_DECADES, Y_FLOOR_LOG10),
    maxLog10: maxLog + Y_MARGIN_DECADES,
  };
}

// --- Axis ticks ------------------------------------------------------------

export const X_MAJOR_TICKS_NM = [
  100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000,
] as const;
export const X_DECADE_TICKS_NM = [100, 1000, 10_000, 100_000] as const;

// Lighter grid lines at 2..9 × 10^d inside the window.
export function xMinorGridNm(): number[] {
  const out: number[] = [];
  for (let decade = 100; decade < WAVELENGTH_MAX_NM; decade *= 10) {
    for (let k = 2; k <= 9; k++) out.push(k * decade);
  }
  return out;
}

// How many decades to skip between labelled y ticks so labels stay legible.
// With a 60-decade axis (6000 K) this lands on a label every 5 or 10 decades.
export function yLabelStepDecades(pixelsPerDecade: number, minLabelSpacingPx: number): number {
  for (const step of [1, 2, 5, 10, 20, 50, 100]) {
    if (step * pixelsPerDecade >= minLabelSpacingPx) return step;
  }
  return 100;
}

// Integer exponents n with 10^n inside [minLog10, maxLog10].
export function yDecades(limits: YAxisLimits): number[] {
  const out: number[] = [];
  for (let n = Math.ceil(limits.minLog10); n <= Math.floor(limits.maxLog10); n++) out.push(n);
  return out;
}

// --- Number formatting -----------------------------------------------------

// "10^-40": a y-axis tick label, in the caret form that rich-text.ts turns
// into a real superscript on each surface.
export function formatPowerOfTen(exponent: number): string {
  return `10^${exponent}`;
}

// Three significant figures in scientific notation: "3.18 × 10^13". Returns
// null for a value that cannot be shown (not finite).
export function formatScientific(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  if (value === 0) return "0";
  const [mantissa, exponent] = value.toExponential(2).split("e");
  return `${mantissa} × 10^${Number(exponent)}`;
}

// Three significant figures, plain: a cursor wavelength such as 500 or 1,230.
// `locale` only changes the grouping separator.
export function formatThreeSignificant(value: number, locale = "en"): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 3 }).format(value);
}

export function formatInteger(value: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}
