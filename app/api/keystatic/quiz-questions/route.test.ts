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
  },
}));

import { GET, POST } from "./route";

describe("quiz authoring API access control", () => {
  beforeEach(() => {
    fixture.user = null;
    fixture.isAdmin = false;
    fixture.dbCalls = 0;
  });

  it("requires a signed-in session before reading admin question data", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
    expect(fixture.dbCalls).toBe(0);
  });

  it("rejects signed-in non-admins before reading admin question data", async () => {
    fixture.user = { id: "student", email: "student@example.com" };
    const response = await GET();
    expect(response.status).toBe(403);
    expect(fixture.dbCalls).toBe(0);
  });

  it("rejects writes from non-admin accounts before touching the database", async () => {
    fixture.user = { id: "student", email: "student@example.com" };
    const response = await POST(new Request("http://localhost/api/keystatic/quiz-questions", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    }));
    expect(response.status).toBe(403);
    expect(fixture.dbCalls).toBe(0);
  });
});
