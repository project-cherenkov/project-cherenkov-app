import { describe, expect, it } from "vitest";
import { generateFeedToken, hashFeedToken, isWellFormedFeedToken, tokenFromSegment } from "./calendar-feed-token";

describe("feed token", () => {
  it("is 256 bits of base64url and different every time", () => {
    const a = generateFeedToken();
    expect(a).toHaveLength(43);
    expect(isWellFormedFeedToken(a)).toBe(true);
    expect(generateFeedToken()).not.toBe(a);
  });
  it("hashes to a stable SHA-256 hex digest that does not contain the token", () => {
    const token = generateFeedToken();
    expect(hashFeedToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashFeedToken(token)).toBe(hashFeedToken(token));
    expect(hashFeedToken(token)).not.toContain(token);
  });
  it("rejects malformed tokens and strips a .ics suffix", () => {
    for (const bad of ["", "short", "a".repeat(44), `${"a".repeat(42)}!`, "../etc/passwd"]) expect(isWellFormedFeedToken(bad)).toBe(false);
    expect(tokenFromSegment("abc.ics")).toBe("abc");
    expect(tokenFromSegment("abc")).toBe("abc");
  });
});
