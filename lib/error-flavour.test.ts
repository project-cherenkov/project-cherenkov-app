import { describe, expect, it } from "vitest";

import { ERROR_FLAVOUR, fillFlavour, flavourFor, pickFragment } from "./error-flavour";

describe("ERROR_FLAVOUR", () => {
  it("has at least one non-empty line for every locale and screen", () => {
    for (const locale of ["id", "en"] as const) {
      for (const screen of ["notFound", "error"] as const) {
        const lines = ERROR_FLAVOUR[locale][screen];
        expect(lines.length, `${locale}.${screen}`).toBeGreaterThan(0);
        for (const line of lines) expect(line.trim(), `${locale}.${screen}`).not.toBe("");
      }
    }
  });

  it("only uses {path} on the not-found screen, where there is an address", () => {
    for (const locale of ["id", "en"] as const) {
      for (const line of ERROR_FLAVOUR[locale].error) expect(line).not.toContain("{path}");
    }
  });
});

describe("flavourFor", () => {
  it("returns the lines for the locale and falls back to Indonesian", () => {
    expect(flavourFor("en", "notFound")).toBe(ERROR_FLAVOUR.en.notFound);
    expect(flavourFor("fr", "error")).toBe(ERROR_FLAVOUR.id.error);
  });
});

describe("fillFlavour", () => {
  it("puts the requested address into the line", () => {
    expect(fillFlavour("Lost at {path} today.", "/en/nope")).toBe("Lost at /en/nope today.");
  });

  it("drops the token cleanly when there is no address", () => {
    expect(fillFlavour("Whatever lived at {path} is gone.", "")).toBe("Whatever lived at is gone.");
    expect(fillFlavour("Nothing here.", "")).toBe("Nothing here.");
  });
});

describe("pickFragment", () => {
  it("never repeats the current line when it can avoid it", () => {
    for (let current = 0; current < 4; current += 1) {
      for (const roll of [0, 0.24, 0.26, 0.5, 0.74, 0.99]) {
        expect(pickFragment(4, current, () => roll)).not.toBe(current);
      }
    }
  });

  it("copes with one line or none", () => {
    expect(pickFragment(1, 0)).toBe(0);
    expect(pickFragment(0)).toBe(0);
  });
});
