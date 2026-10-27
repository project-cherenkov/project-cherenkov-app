import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  isAdmin: false,
  dbCalls: 0,
}));
vi.mock("@/lib/auth-guard", () => ({ getCurrentUser: async () => fixture.user }));
vi.mock("@/lib/admin-guard", () => ({ isAdminEmail: () => fixture.isAdmin }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => { fixture.dbCalls++; throw new Error("database must not be queried before authorization"); },
    update: () => { fixture.dbCalls++; throw new Error("database must not be updated before authorization"); },
  },
}));
import { PATCH } from "./route";

describe("quiz question edits access control", () => {
  beforeEach(() => { fixture.user = null; fixture.isAdmin = false; fixture.dbCalls = 0; });
  it("rejects unauthenticated edits before reading or writing database rows", async () => {
    const response = await PATCH(new Request("http://localhost/api/keystatic/quiz-questions/q1", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "q1" }) });
    expect(response.status).toBe(401);
    expect(fixture.dbCalls).toBe(0);
  });
});
