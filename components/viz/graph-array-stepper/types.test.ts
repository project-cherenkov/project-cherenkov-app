import { describe, expect, it } from "vitest";
import { isGraphArrayStepperConfig } from "./types";

describe("isGraphArrayStepperConfig", () => {
  it("rejects an empty steps array", () => {
    expect(isGraphArrayStepperConfig({ array: [1, 2, 3], steps: [] })).toBe(false);
  });

  it("accepts a valid stepper config", () => {
    expect(
      isGraphArrayStepperConfig({
        array: [1, 2, 3],
        steps: [{ pointers: { lo: 0, hi: 2 }, highlight: [1] }],
      }),
    ).toBe(true);
  });

  // CH-09 (architect audit round 1)
  it("rejects an out-of-range pointer index", () => {
    expect(
      isGraphArrayStepperConfig({
        array: [1, 2, 3],
        steps: [{ pointers: { lo: 0, hi: 12 } }],
      }),
    ).toBe(false);
  });

  it("rejects an out-of-range highlight index", () => {
    expect(
      isGraphArrayStepperConfig({
        array: [1, 2, 3],
        steps: [{ pointers: { lo: 0, hi: 2 }, highlight: [7] }],
      }),
    ).toBe(false);
  });

  it("rejects a negative pointer or highlight index", () => {
    expect(
      isGraphArrayStepperConfig({
        array: [1, 2, 3],
        steps: [{ pointers: { lo: -1, hi: 2 } }],
      }),
    ).toBe(false);
    expect(
      isGraphArrayStepperConfig({
        array: [1, 2, 3],
        steps: [{ pointers: { lo: 0, hi: 2 }, highlight: [-1] }],
      }),
    ).toBe(false);
  });
});