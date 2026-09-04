import { describe, expect, it } from "vitest";
import * as schema from "./db/schema";

describe("Better Auth schema contract", () => {
  it("matches the Better Auth v1.4.x account shape used by this project", () => {
    expect(schema.account.accountId).toBeDefined();
    expect(schema.account.providerId).toBeDefined();
    expect(schema.account.userId).toBeDefined();
    expect("issuer" in schema.account).toBe(false);
  });
});
