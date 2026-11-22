import { describe, expect, it } from "vitest";
import {
  COMPANION_MAX_CHATS,
  COMPANION_MAX_CHAT_MESSAGES,
  COMPANION_MAX_OUTPUT_TOKENS,
  COMPANION_PERSONAL_DAILY_LIMIT,
  COMPANION_SIZES,
  COMPANION_STYLES,
  COMPANION_SIZE_PX,
  DEFAULT_COMPANION_PREFS,
  normalizeCompanionPrefs,
  parseCompanionPatch,
} from "./companion-settings";

describe("parseCompanionPatch", () => {
  it("accepts a single valid field and returns only that field", () => {
    expect(parseCompanionPatch({ size: "large" })).toEqual({ size: "large" });
    expect(parseCompanionPatch({ enabled: false })).toEqual({ enabled: false });
    expect(parseCompanionPatch({ aiEnabled: false })).toEqual({ aiEnabled: false });
    expect(parseCompanionPatch({ rotation: "flat" })).toEqual({ rotation: "flat" });
    expect(parseCompanionPatch({ aiBannerDismissed: true })).toEqual({ aiBannerDismissed: true });
    expect(parseCompanionPatch({ faqBannerDismissed: true })).toEqual({ faqBannerDismissed: true });
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
    expect(parseCompanionPatch({ aiEnabled: "no" })).toBeNull();
    expect(parseCompanionPatch({ aiEnabled: 0 })).toBeNull();
    expect(parseCompanionPatch({ aiBannerDismissed: "true" })).toBeNull();
    expect(parseCompanionPatch({ faqBannerDismissed: 1 })).toBeNull();
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

describe("the AI switch", () => {
  it("is on by default, and independent of the companion itself", () => {
    expect(DEFAULT_COMPANION_PREFS.aiEnabled).toBe(true);
    expect(normalizeCompanionPrefs({ aiEnabled: false })).toMatchObject({ aiEnabled: false, enabled: true });
    expect(normalizeCompanionPrefs({ enabled: false })).toMatchObject({ aiEnabled: true, enabled: false });
  });
  it("ignores a stored value that is not a boolean", () => {
    expect(normalizeCompanionPrefs({ aiEnabled: "false" }).aiEnabled).toBe(true);
  });
});

describe("sizes", () => {
  it("keeps every size at or above a 44px touch target", () => {
    for (const size of COMPANION_SIZES) expect(COMPANION_SIZE_PX[size]).toBeGreaterThanOrEqual(44);
  });
});

describe("style setting", () => {
  it("defaults to pixel for everyone, including a missing or invalid value", () => {
    expect(DEFAULT_COMPANION_PREFS.style).toBe("pixel");
    expect(normalizeCompanionPrefs(undefined).style).toBe("pixel");
    expect(normalizeCompanionPrefs({ style: "neon" }).style).toBe("pixel");
    expect(normalizeCompanionPrefs({ style: "smooth" }).style).toBe("smooth");
  });

  it("accepts only the listed styles in a patch", () => {
    for (const style of COMPANION_STYLES) expect(parseCompanionPatch({ style })).toEqual({ style });
    expect(parseCompanionPatch({ style: "retro" })).toBeNull();
    expect(parseCompanionPatch({ style: 1 })).toBeNull();
  });
});

describe("chat limits", () => {
  it("keeps the decided numbers in one place", () => {
    expect(COMPANION_MAX_CHATS).toBe(15);
    expect(COMPANION_MAX_CHAT_MESSAGES).toBe(30);
    expect(COMPANION_MAX_OUTPUT_TOKENS).toBe(1500);
    expect(COMPANION_PERSONAL_DAILY_LIMIT).toBe(200);
  });
});
