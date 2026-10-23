import { describe, expect, it } from "vitest";

import {
  PRACTICE_LINK_STALE_DAYS,
  isPracticeLinkStale,
  isSafePracticeUrl,
  practiceLinkAgeDays,
} from "./practice-links";

describe("isSafePracticeUrl", () => {
  it("accepts https URLs with a real host", () => {
    expect(isSafePracticeUrl("https://tlx.toki.id/problems")).toBe(true);
  });

  it("rejects other schemes and junk", () => {
    for (const bad of [
      "http://tlx.toki.id/problems",
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "//tlx.toki.id",
      "tlx.toki.id",
      "https://localhost",
      "",
      "not a url",
    ]) {
      expect(isSafePracticeUrl(bad), bad).toBe(false);
    }
  });
});

describe("staleness", () => {
  const now = new Date("2026-10-20T00:00:00Z");

  it("counts whole days since the check", () => {
    expect(practiceLinkAgeDays("2026-10-10", now)).toBe(10);
    expect(practiceLinkAgeDays("2026-10-10T00:00:00.000Z", now)).toBe(10);
  });

  it("is stale only after the threshold", () => {
    const exactly = new Date(now.getTime() - PRACTICE_LINK_STALE_DAYS * 86_400_000).toISOString();
    expect(isPracticeLinkStale(exactly, now)).toBe(false);
    const over = new Date(now.getTime() - (PRACTICE_LINK_STALE_DAYS + 1) * 86_400_000).toISOString();
    expect(isPracticeLinkStale(over, now)).toBe(true);
  });

  it("treats an unparseable date as stale rather than fresh", () => {
    expect(isPracticeLinkStale("last tuesday", now)).toBe(true);
  });
});
