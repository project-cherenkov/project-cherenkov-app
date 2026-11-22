import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ claimed: [] as Array<{ userId: string; lang: string }>, exists: false, calendar: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n" as string | null }));

vi.mock("@/lib/db", () => ({
  db: {
    update: () => ({ set: () => ({ where: () => ({ returning: async () => state.claimed }) }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (state.exists ? [{ userId: "u" }] : []) }) }) }),
  },
}));
vi.mock("@/lib/calendar-plan-db", () => ({ renderPlanCalendar: async () => state.calendar }));

import { GET } from "./route";

const token = "A".repeat(43);
const call = (segment: string) => GET(new Request("https://example.test/x"), { params: Promise.resolve({ token: segment }) });

beforeEach(() => { state.claimed = []; state.exists = false; state.calendar = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"; });

describe("public calendar feed", () => {
  it("answers 404 for a malformed token, without touching the database", async () => {
    expect((await call("nope")).status).toBe(404);
  });
  it("answers the same 404 for an unknown or revoked token", async () => {
    const response = await call(`${token}.ics`);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("serves text/calendar with no-cache, noindex and no cookie", async () => {
    state.claimed = [{ userId: "u", lang: "id" }];
    const response = await call(`${token}.ics`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("cache-control")).toContain("no-cache");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("throttles a feed that was fetched a moment ago", async () => {
    state.exists = true;
    const response = await call(token);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });
  it("serves an empty but valid calendar when there is no plan yet", async () => {
    state.claimed = [{ userId: "u", lang: "en" }];
    state.calendar = null;
    const body = await (await call(token)).text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).not.toContain("VEVENT");
  });
});
