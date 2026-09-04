import { s } from "velite";
import { describe, expect, it } from "vitest";
import { vizEngines } from "./velite.config";

// Schema-level check for SCENE-002's only change to this file (the
// vizEngines tuple) — a full `pnpm generate` build-time check against a
// composed-scene fixture file was also run manually during implementation
// (see the implementation report) and passed; this test keeps that
// coverage exercised on every run without needing a committed fixture MDX
// file just for the test.
describe("velite.config vizEngines", () => {
  const schema = s.enum(vizEngines);

  it("accepts composed-scene", () => {
    expect(schema.safeParse("composed-scene").success).toBe(true);
  });

  it("still accepts all four pre-existing values, unchanged", () => {
    for (const value of ["graph-array-stepper", "trajectory-sandbox", "orbital-sandbox", "none"]) {
      expect(schema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects a value outside the enum", () => {
    expect(schema.safeParse("not-a-real-engine").success).toBe(false);
  });
});
