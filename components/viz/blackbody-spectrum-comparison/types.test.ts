import { describe, expect, it } from "vitest";

import {
  initialTemperatureOf,
  isBlackbodySpectrumComparisonConfig,
  temperatureRangeOf,
  temperatureStepOf,
} from "./types";

describe("isBlackbodySpectrumComparisonConfig", () => {
  it("accepts an empty config: every field is optional", () => {
    expect(isBlackbodySpectrumComparisonConfig({})).toBe(true);
  });

  it("accepts the config the editorial ships with", () => {
    expect(
      isBlackbodySpectrumComparisonConfig({
        temperatureK: 6000,
        temperatureRangeK: [3000, 12000],
        temperatureStepK: 250,
      }),
    ).toBe(true);
  });

  it("rejects anything that is not a plain object", () => {
    for (const value of [null, undefined, 42, "x", [], [1, 2]]) {
      expect(isBlackbodySpectrumComparisonConfig(value)).toBe(false);
    }
  });

  it("rejects a temperature range with a non-positive lower bound (T is a divisor)", () => {
    expect(isBlackbodySpectrumComparisonConfig({ temperatureRangeK: [0, 12000] })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureRangeK: [-5, 12000] })).toBe(false);
  });

  it("rejects an empty, reversed, wrong-length or non-numeric range", () => {
    expect(isBlackbodySpectrumComparisonConfig({ temperatureRangeK: [5000, 5000] })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureRangeK: [9000, 3000] })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureRangeK: [3000] })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureRangeK: [3000, 6000, 9000] })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureRangeK: ["3000", 6000] })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureRangeK: [3000, Infinity] })).toBe(false);
  });

  it("rejects an initial temperature outside the range (default or explicit)", () => {
    expect(isBlackbodySpectrumComparisonConfig({ temperatureK: 2000 })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureK: 13000 })).toBe(false);
    expect(
      isBlackbodySpectrumComparisonConfig({ temperatureK: 6000, temperatureRangeK: [7000, 9000] }),
    ).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureK: Number.NaN })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureK: "6000" })).toBe(false);
  });

  it("accepts the range ends as initial temperatures", () => {
    expect(isBlackbodySpectrumComparisonConfig({ temperatureK: 3000 })).toBe(true);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureK: 12000 })).toBe(true);
  });

  it("rejects a step that is not positive, or wider than the whole range", () => {
    expect(isBlackbodySpectrumComparisonConfig({ temperatureStepK: 0 })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureStepK: -250 })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureStepK: 9001 })).toBe(false);
    expect(isBlackbodySpectrumComparisonConfig({ temperatureStepK: 9000 })).toBe(true);
    expect(
      isBlackbodySpectrumComparisonConfig({ temperatureRangeK: [5000, 5500], temperatureStepK: 1000 }),
    ).toBe(false);
  });
});

describe("config defaults", () => {
  it("uses 6000 K, [3000, 12000] K and 250 K from the brief", () => {
    expect(initialTemperatureOf({})).toBe(6000);
    expect(temperatureRangeOf({})).toEqual([3000, 12000]);
    expect(temperatureStepOf({})).toBe(250);
  });

  it("clamps the default start into a narrowed range", () => {
    expect(initialTemperatureOf({ temperatureRangeK: [7000, 9000] })).toBe(7000);
    expect(initialTemperatureOf({ temperatureRangeK: [1000, 2000] })).toBe(2000);
  });

  it("keeps an explicit start inside the range", () => {
    expect(initialTemperatureOf({ temperatureK: 8000 })).toBe(8000);
  });
});
