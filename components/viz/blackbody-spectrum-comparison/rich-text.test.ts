import { describe, expect, it } from "vitest";

import { toRuns, toUnicodeSuperscripts } from "./rich-text";

describe("toRuns", () => {
  it("splits an exponent into its own superscript run", () => {
    expect(toRuns("3.18 × 10^13")).toEqual([
      { text: "3.18 × 10", superscript: false },
      { text: "13", superscript: true },
    ]);
  });

  it("uses a real minus sign (U+2212) for a negative exponent", () => {
    expect(toRuns("10^-40")).toEqual([
      { text: "10", superscript: false },
      { text: "\u221240", superscript: true },
    ]);
  });

  it("handles several exponents and trailing text", () => {
    expect(toRuns("(W m^-3 sr^-1)").map((r) => r.text)).toEqual(["(W m", "\u22123", " sr", "\u22121", ")"]);
  });

  it("leaves text without a caret alone", () => {
    expect(toRuns("Wavelength (nm)")).toEqual([{ text: "Wavelength (nm)", superscript: false }]);
    expect(toRuns("")).toEqual([]);
  });
});

describe("toUnicodeSuperscripts", () => {
  it("turns the caret form into spoken-friendly superscripts", () => {
    expect(toUnicodeSuperscripts("W m^-3 sr^-1")).toBe("W m⁻³ sr⁻¹");
    expect(toUnicodeSuperscripts("2.50 × 10^1")).toBe("2.50 × 10¹");
    expect(toUnicodeSuperscripts("10^0")).toBe("10⁰");
  });
});
