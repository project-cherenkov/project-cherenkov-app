import { describe, expect, it } from "vitest";

import { isSafeReturnTo } from "./safe-redirect";

// T-01 acceptance criteria, verified directly against the canonical
// implementation (lib/scene-builder-oauth.ts re-exports this same
// function; see that module's tests for the OAuth-route-level coverage).
describe("isSafeReturnTo", () => {
  it("rejects a backslash-based origin bypass (F-01 / F-02)", () => {
    expect(isSafeReturnTo("/\\evil.example")).toBe(false);
  });

  it("rejects a backslash anywhere in an otherwise-safe-looking path", () => {
    expect(isSafeReturnTo("/keystatic/\\evil")).toBe(false);
    expect(isSafeReturnTo("/a/b\\c")).toBe(false);
  });

  it("accepts a genuine same-origin relative path", () => {
    expect(isSafeReturnTo("/keystatic/scene-builder")).toBe(true);
    expect(isSafeReturnTo("/planner")).toBe(true);
    expect(isSafeReturnTo("/quiz")).toBe(true);
  });

  it("rejects a protocol-relative URL (//evil.example)", () => {
    expect(isSafeReturnTo("//evil.example")).toBe(false);
  });

  it("rejects a full external URL", () => {
    expect(isSafeReturnTo("https://evil.example")).toBe(false);
    expect(isSafeReturnTo("http://evil.example")).toBe(false);
  });

  it("rejects a value that doesn't start with a slash", () => {
    expect(isSafeReturnTo("evil.example")).toBe(false);
    expect(isSafeReturnTo("planner")).toBe(false);
  });

  it("rejects empty, null, and undefined values", () => {
    expect(isSafeReturnTo("")).toBe(false);
    expect(isSafeReturnTo(null)).toBe(false);
    expect(isSafeReturnTo(undefined)).toBe(false);
  });

  it("every value new URL(value, origin) would resolve off-origin is rejected", () => {
    const origin = "https://project-cherenkov.example";
    const candidates = [
      "/\\evil.example",
      "//evil.example",
      "https://evil.example",
    ];
    for (const candidate of candidates) {
      if (isSafeReturnTo(candidate)) {
        const resolved = new URL(candidate, origin);
        expect(resolved.origin).toBe(origin);
      } else {
        expect(isSafeReturnTo(candidate)).toBe(false);
      }
    }
  });
});
