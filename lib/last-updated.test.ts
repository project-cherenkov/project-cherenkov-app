import { describe, expect, it } from "vitest";

import { formatCommitDate, formatCommitTimestamp } from "./last-updated";

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

describe("formatCommitDate", () => {
  it("spells the month out so the day and month cannot be swapped", () => {
    expect(formatCommitDate("2026-11-07T17:54:38+07:00", "en")).toBe("Nov 7, 2026");
    expect(formatCommitDate("2026-11-07T17:54:38+07:00", "id")).toBe("7 Nov 2026");
  });

  it("keeps the commit's calendar day whatever the offset", () => {
    expect(formatCommitDate("2026-11-07T00:10:00+07:00", "id")).toBe("7 Nov 2026");
    expect(formatCommitDate("2026-11-07T23:50:00-08:00", "id")).toBe("7 Nov 2026");
  });

  it("rejects timestamps that are not ISO commit timestamps", () => {
    expect(() => formatCommitDate("07/11/2026", "en")).toThrow("Invalid commit timestamp");
  });
});
