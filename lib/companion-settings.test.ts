import { describe, expect, it } from "vitest";
import {
  COMPANION_SIZES,
  COMPANION_SIZE_PX,
  DEFAULT_COMPANION_PREFS,
  normalizeCompanionPrefs,
  parseCompanionPatch,
} from "./companion-settings";

describe("parseCompanionPatch", () => {
  it("accepts a single valid field and returns only that field", () => {
    expect(parseCompanionPatch({ size: "large" })).toEqual({ size: "large" });
    expect(parseCompanionPatch({ enabled: false })).toEqual({ enabled: false });
    expect(parseCompanionPatch({ rotation: "flat" })).toEqual({ rotation: "flat" });
  });

  it("trims the name and enforces 1-32 characters", () => {
    expect(parseCompanionPatch({ name: "  Nova  " })).toEqual({ name: "Nova" });
    expect(parseCompanionPatch({ name: "   " })).toBeNull();
    expect(parseCompanionPatch({ name: "x".repeat(33) })).toBeNull();
    expect(parseCompanionPatch({ name: "x".repeat(32) })).toEqual({ name: "x".repeat(32) });
  });

  it("rejects the whole request when any field is invalid", () => {
    expect(parseCompanionPatch({ size: "large", rotation: "spin" })).toBeNull();
    expect(parseCompanionPatch({ enabled: "yes" })).toBeNull();
    expect(parseCompanionPatch({ size: "huge" })).toBeNull();
  });

  it("rejects non-objects and empty or unknown-only bodies", () => {
    expect(parseCompanionPatch(null)).toBeNull();
    expect(parseCompanionPatch("size")).toBeNull();
    expect(parseCompanionPatch([])).toBeNull();
    expect(parseCompanionPatch({})).toBeNull();
    expect(parseCompanionPatch({ colour: "pink" })).toBeNull();
  });

  it("ignores unknown extra fields alongside valid ones", () => {
    expect(parseCompanionPatch({ size: "small", userId: "someone-else" })).toEqual({ size: "small" });
  });
});

describe("normalizeCompanionPrefs", () => {
  it("falls back to defaults field by field", () => {
    expect(normalizeCompanionPrefs(undefined)).toEqual(DEFAULT_COMPANION_PREFS);
    expect(normalizeCompanionPrefs({ size: "large", rotation: "nope", name: "" })).toEqual({
      ...DEFAULT_COMPANION_PREFS,
      size: "large",
    });
  });
});

describe("sizes", () => {
  it("keeps every size at or above a 44px touch target", () => {
    for (const size of COMPANION_SIZES) expect(COMPANION_SIZE_PX[size]).toBeGreaterThanOrEqual(44);
  });
});
