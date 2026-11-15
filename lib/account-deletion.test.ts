import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ table: null as unknown, where: null as unknown }));

vi.mock("@/lib/db", () => ({
  db: {
    delete: (table: unknown) => {
      calls.table = table;
      return { where: async (condition: unknown) => { calls.where = condition; } };
    },
  },
}));

import { verification } from "@/lib/db/schema";
import { removeVerificationRowsForUser } from "./account-deletion";

describe("removeVerificationRowsForUser", () => {
  it("deletes from the verification table, filtered by the user id", async () => {
    await removeVerificationRowsForUser("user-1");
    expect(calls.table).toBe(verification);
    expect(calls.where).toBeTruthy();
  });
});
