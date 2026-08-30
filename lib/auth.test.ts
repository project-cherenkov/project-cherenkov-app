import { describe, expect, it } from "vitest";
import { auth } from "./auth";

describe("auth export", () => {
  it("exposes the Better Auth Next.js handler contract", () => {
    expect("handler" in auth).toBe(true);
    expect(typeof auth.handler).toBe("function");
  });
});
