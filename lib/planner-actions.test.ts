import { describe, expect, it } from "vitest";
import { generatePlan } from "./planner-actions";

// ROBUST-002 / TICKET-05 required test: a malformed targetExamDate returns
// a clean validation failure rather than throwing inside the Server
// Action. Checked before the auth lookup (see planner-actions.ts), so this
// is deterministic without any DATABASE_URL/session setup.
describe("generatePlan — targetExamDate validation", () => {
  it("rejects a non-date string", async () => {
    const result = await generatePlan("not-a-date");
    expect(result).toEqual({ ok: false, reason: "invalid_date" });
  });

  it("rejects an empty string", async () => {
    const result = await generatePlan("");
    expect(result).toEqual({ ok: false, reason: "invalid_date" });
  });

  it("rejects a calendar-invalid date (Feb 30)", async () => {
    const result = await generatePlan("2026-02-30");
    expect(result).toEqual({ ok: false, reason: "invalid_date" });
  });

  it("rejects a non-ISO format (MM/DD/YYYY)", async () => {
    const result = await generatePlan("06/05/2026");
    expect(result).toEqual({ ok: false, reason: "invalid_date" });
  });

  it("passes a well-formed ISO date through to the auth check", async () => {
    // No DATABASE_URL in this test environment, so a validly-formatted
    // date should fail closed as unauthenticated (lib/auth-guard.ts),
    // never as invalid_date and never by throwing.
    delete process.env.DATABASE_URL;
    const result = await generatePlan("2026-06-05");
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  });
});
