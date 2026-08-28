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
});