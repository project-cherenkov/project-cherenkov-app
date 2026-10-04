import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "Today" for plan generation is the student's calendar day (default
// Asia/Jakarta), not the server's. Kept in its own file because it mocks the
// database and the plan core, unlike planner-actions.test.ts which exercises
// the real modules.
const fixture = vi.hoisted(() => ({
  settings: [] as { timezone: string }[],
  coreCalls: [] as { targetExamDate: string; today: string }[],
}));

vi.mock("@/lib/auth-guard", () => ({
  getCurrentUser: async () => ({ id: "user-1", email: "u@example.com" }),
}));

vi.mock("@/lib/db", () => {
  const builder = {
    from: () => builder,
    where: () => builder,
    limit: () => builder,
    then(resolve: (rows: unknown[]) => void, reject?: (e: unknown) => void) {
      return Promise.resolve(fixture.settings).then(resolve, reject);
    },
  };
  return { db: { select: () => builder } };
});

vi.mock("@/lib/plan-generator", () => ({
  generateOrRegeneratePlanCore: async (
    _deps: unknown,
    _userId: string,
    targetExamDate: string,
    today: string,
  ) => {
    fixture.coreCalls.push({ targetExamDate, today });
    return { ok: true, planId: "plan-1", itemCount: 0 };
  },
}));

import { generatePlan } from "./planner-actions";

beforeEach(() => {
  fixture.settings = [];
  fixture.coreCalls = [];
  vi.useFakeTimers();
  // 18:00 UTC on 3 Oct = 01:00 on 4 Oct in Jakarta.
  vi.setSystemTime(new Date("2026-10-03T18:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("generatePlan — student's own calendar day", () => {
  it("uses the Jakarta date, which is already the next day while the server is still on the previous UTC day", async () => {
    const result = await generatePlan("2026-12-01");
    expect(result).toEqual({ ok: true });
    expect(fixture.coreCalls[0]?.today).toBe("2026-10-04");
  });

  it("rejects an exam date that is yesterday for the student even though it is still today in UTC", async () => {
    const result = await generatePlan("2026-10-03");
    expect(result).toEqual({ ok: false, reason: "invalid_date" });
    expect(fixture.coreCalls).toHaveLength(0);
  });

  it("accepts the student's own today as the exam date", async () => {
    expect(await generatePlan("2026-10-04")).toEqual({ ok: true });
  });

  it("uses the time zone saved in the student's planner settings", async () => {
    fixture.settings = [{ timezone: "America/Los_Angeles" }];
    // The pre-auth sanity check uses Jakarta, so pick a date valid there too.
    await generatePlan("2026-12-01");
    expect(fixture.coreCalls[0]?.today).toBe("2026-10-03");
  });

  it("falls back to Jakarta when the saved zone name is not valid", async () => {
    fixture.settings = [{ timezone: "Mars/Olympus" }];
    await generatePlan("2026-12-01");
    expect(fixture.coreCalls[0]?.today).toBe("2026-10-04");
  });
});
