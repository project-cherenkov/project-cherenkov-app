import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  isAdmin: false,
  dbCalls: 0,
  set: [] as unknown[],
  matched: 1,
}));
vi.mock("@/lib/auth-guard", () => ({ getCurrentUser: async () => fixture.user }));
vi.mock("@/lib/admin-guard", () => ({ isVerifiedAdmin: () => fixture.isAdmin }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => { fixture.dbCalls++; throw new Error("database must not be queried before authorization"); },
    update: () => {
      fixture.dbCalls++;
      if (!fixture.isAdmin) throw new Error("database must not be updated before authorization");
      return {
        set: (values: unknown) => {
          fixture.set.push(values);
          return { where: () => ({ returning: async () => (fixture.matched ? [{ id: "q" }] : []) }) };
        },
      };
    },
  },
}));
import { PATCH } from "./route";

const ID = "0b9f3f0e-6f3a-4d2e-8d1a-3b6c5a1d9e10";
const patch = (body: unknown, id = ID) =>
  PATCH(new Request(`http://localhost/api/keystatic/quiz-questions/${id}`, { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

describe("quiz question edits access control", () => {
  beforeEach(() => { fixture.user = null; fixture.isAdmin = false; fixture.dbCalls = 0; fixture.set = []; fixture.matched = 1; });
  it("rejects unauthenticated edits before reading or writing database rows", async () => {
    const response = await PATCH(new Request("http://localhost/api/keystatic/quiz-questions/q1", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "q1" }) });
    expect(response.status).toBe(401);
    expect(fixture.dbCalls).toBe(0);
  });
});

describe("the archive switch", () => {
  beforeEach(() => {
    fixture.user = { id: "editor", email: "editor@example.com" };
    fixture.isAdmin = true;
    fixture.dbCalls = 0; fixture.set = []; fixture.matched = 1;
  });

  it("archives and restores a question", async () => {
    expect((await patch({ archived: true })).status).toBe(200);
    expect((await patch({ archived: false })).status).toBe(200);
    expect(fixture.set).toEqual([{ archived: true }, { archived: false }]);
  });

  it("writes only the archive flag even if the body carries content fields", async () => {
    await patch({ archived: true, prompt: "changed", correctChoiceIndex: 2, status: "reviewed" });
    expect(fixture.set).toEqual([{ archived: true }]);
  });

  it("rejects a body without a boolean archive state", async () => {
    const response = await patch({ prompt: "changed" });
    expect(response.status).toBe(400);
    expect(fixture.dbCalls).toBe(0);
  });

  it("404s for a malformed id or an id that matches no row", async () => {
    expect((await patch({ archived: true }, "not-a-uuid")).status).toBe(404);
    fixture.matched = 0;
    expect((await patch({ archived: true })).status).toBe(404);
  });
});
