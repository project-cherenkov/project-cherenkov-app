import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { account, session, user, verification } from "./schema";

// T-07 / F-06 / F-10 regression: these four tables previously diverged
// from the real `better-auth@1.4.22` generator output (verified during
// implementation by actually running
// `npx @better-auth/cli generate --config lib/auth.ts` against the
// installed version and diffing the result). No live DB is needed here —
// this introspects the Drizzle table definitions directly via
// getTableConfig, the same way drizzle-kit itself reads them.
function indexNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}

function columnByName(table: Parameters<typeof getTableConfig>[0], name: string) {
  const column = getTableConfig(table).columns.find((c) => c.name === name);
  if (!column) throw new Error(`no such column: ${name}`);
  return column;
}

describe("lib/db/schema.ts — Better Auth tables (T-07)", () => {
  it("session has an index on userId", () => {
    expect(indexNames(session)).toContain("session_userId_idx");
  });

  it("account has an index on userId", () => {
    expect(indexNames(account)).toContain("account_userId_idx");
  });

  it("verification has an index on identifier", () => {
    expect(indexNames(verification)).toContain("verification_identifier_idx");
  });

  it("verification.createdAt and verification.updatedAt are NOT NULL", () => {
    expect(columnByName(verification, "created_at").notNull).toBe(true);
    expect(columnByName(verification, "updated_at").notNull).toBe(true);
  });

  it("user.updatedAt, session.updatedAt, and account.updatedAt have an $onUpdate hook", () => {
    for (const [table, name] of [
      [user, "user"],
      [session, "session"],
      [account, "account"],
    ] as const) {
      const column = columnByName(table, "updated_at");
      expect(column.onUpdateFn, `${name}.updatedAt should have $onUpdate`).toBeInstanceOf(Function);
      // Confirm it actually produces a Date, not just that something is set.
      expect(column.onUpdateFn?.()).toBeInstanceOf(Date);
    }
  });

  it("does not add an index to columns/tables outside this task's scope", () => {
    // Guards the "do not change any other table" constraint: verification
    // only gained the one index above, nothing on id/value/expiresAt.
    expect(indexNames(verification)).toEqual(["verification_identifier_idx"]);
  });
});
