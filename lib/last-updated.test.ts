import { describe, expect, it } from "vitest";

import { formatCommitTimestamp } from "./last-updated";

describe("formatCommitTimestamp", () => {
  it("formats the commit timestamp while preserving its commit timezone", () => {
    expect(formatCommitTimestamp("2026-10-31T14:43:47+07:00")).toBe(
      "31/10/2026, 14:43:47",
    );
  });

  it("rejects timestamps that are not ISO commit timestamps", () => {
    expect(() => formatCommitTimestamp("31/10/2026, 14:43:47")).toThrow(
      "Invalid commit timestamp",
    );
  });
});
