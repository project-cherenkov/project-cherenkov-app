import { describe, expect, it } from "vitest";
import * as schema from "./db/schema";

describe("Better Auth schema contract", () => {
  it("includes the required account issuer field for OAuth and credential linking", () => {
    expect("issuer" in schema.account).toBe(true);
    expect(schema.account.issuer).toBeDefined();
  });
});
