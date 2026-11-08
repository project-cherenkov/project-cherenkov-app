// Config for the `blackbody-spectrum-comparison` engine: the Rayleigh–Jeans
// law and Planck's law drawn on one wavelength axis, with a temperature
// slider. Every field is optional because the physics (constants, the 100 nm
// to 100,000 nm display window, 400 samples) is fixed by the engine; the
// config only chooses where the temperature slider starts and what it spans.
//
// The type guard below is the only validation: `vizConfig.value` is an open
// record in velite.config.ts, so a bad config would otherwise fail on the
// reader's screen.
export interface BlackbodySpectrumComparisonConfig {
  temperatureK?: number; // initial temperature, default 6000
  temperatureRangeK?: [number, number]; // slider bounds, default [3000, 12000]
  temperatureStepK?: number; // slider step, default 250
}

export const DEFAULT_TEMPERATURE_K = 6000;
export const DEFAULT_TEMPERATURE_RANGE_K: [number, number] = [3000, 12000];
export const DEFAULT_TEMPERATURE_STEP_K = 250;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// The lower bound must be strictly positive: T appears in a denominator
// (x = hc / (λkT)), and a zero or negative temperature has no blackbody
// spectrum. min < max so the slider has somewhere to go.
function isPositiveRange(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    value[0] > 0 &&
    value[0] < value[1]
  );
}

export function temperatureRangeOf(
  config: BlackbodySpectrumComparisonConfig,
): [number, number] {
  return config.temperatureRangeK ?? DEFAULT_TEMPERATURE_RANGE_K;
}

export function temperatureStepOf(config: BlackbodySpectrumComparisonConfig): number {
  return config.temperatureStepK ?? DEFAULT_TEMPERATURE_STEP_K;
}

// The starting temperature, kept inside the slider's range even when the
// config only narrows the range and leaves `temperatureK` unset.
export function initialTemperatureOf(config: BlackbodySpectrumComparisonConfig): number {
  const [min, max] = temperatureRangeOf(config);
  const wanted = config.temperatureK ?? DEFAULT_TEMPERATURE_K;
  return Math.min(Math.max(wanted, min), max);
}

export function isBlackbodySpectrumComparisonConfig(
  config: unknown,
): config is BlackbodySpectrumComparisonConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  const c = config as Record<string, unknown>;

  const range = c.temperatureRangeK;
  if (range !== undefined && !isPositiveRange(range)) return false;
  const [min, max] = (range as [number, number] | undefined) ?? DEFAULT_TEMPERATURE_RANGE_K;

  if (c.temperatureK !== undefined) {
    if (!isFiniteNumber(c.temperatureK)) return false;
    if (c.temperatureK < min || c.temperatureK > max) return false;
  }
  // No explicit start is fine: initialTemperatureOf() falls back to 6000 K
  // clamped into the range, which is always valid.

  if (c.temperatureStepK !== undefined) {
    if (!isFiniteNumber(c.temperatureStepK) || c.temperatureStepK <= 0) return false;
    // A step wider than the whole range would leave the slider with a single
    // reachable value.
    if (c.temperatureStepK > max - min) return false;
  }
  return true;
}
