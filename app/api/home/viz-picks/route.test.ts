import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ getCurrentUser: () => getCurrentUser() }));

// A minimal stand-in for the drizzle query builder: each chain ends in a
// recorded call, so the tests can check what the route asked the database to do.
const calls: { op: string; arg?: unknown }[] = [];
let storedRow: { picks: unknown } | undefined;
let failNext = false;

function maybeFail() {
  if (failNext) {
    failNext = false;
    throw new Error("db down");
  }
}

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            maybeFail();
            return storedRow ? [storedRow] : [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (values: unknown) => ({
        onConflictDoUpdate: async (config: unknown) => {
          maybeFail();
          calls.push({ op: "upsert", arg: { values, config } });
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        maybeFail();
        calls.push({ op: "delete" });
      },
    }),
  },
}));

import { DELETE, GET, PUT } from "./route";

const A = "physics/projectile-range-symmetry";
const B = "astronomy/eccentric-transit-duration";

function put(body: unknown, raw = false) {
  return PUT(
    new Request("http://localhost/api/home/viz-picks", {
      method: "PUT",
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );
}

describe("/api/home/viz-picks", () => {
  beforeEach(() => {
    calls.length = 0;
    storedRow = undefined;
    failNext = false;
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: "u1" });
  });

  it("refuses every method without a session", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await put({ picks: [A] })).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("GET answers null when the account has no row", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ picks: null });
  });

  it("GET returns the stored picks, cleaned", async () => {
    storedRow = { picks: [A, "not a key", B] };
    expect(await (await GET()).json()).toEqual({ picks: [A, B] });
  });

  it("PUT stores a cleaned selection for this account only", async () => {
    const response = await put({ picks: [B, B, A, "x", "physics/c", "physics/d"] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ picks: [B, A, "physics/c"] });
    const upsert = calls[0]?.arg as { values: { userId: string; picks: string[] } };
    expect(upsert.values).toEqual({ userId: "u1", picks: [B, A, "physics/c"] });
  });

  it("PUT rejects an empty, malformed or non-JSON body and writes nothing", async () => {
    expect((await put({ picks: [] })).status).toBe(400);
    expect((await put({ picks: "physics/a" })).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect((await put("{oops", true)).status).toBe(400);
    expect((await put("null", true)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("DELETE clears the choice", async () => {
    const response = await DELETE();
    expect(await response.json()).toEqual({ picks: null });
    expect(calls).toEqual([{ op: "delete" }]);
  });

  it("answers 503 when the database is unavailable", async () => {
    failNext = true;
    expect((await GET()).status).toBe(503);
    failNext = true;
    expect((await put({ picks: [A] })).status).toBe(503);
    failNext = true;
    expect((await DELETE()).status).toBe(503);
  });
});
