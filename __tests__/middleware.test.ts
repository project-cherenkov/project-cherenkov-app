import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import middleware from "../middleware";

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

// AUTH-002 required test (spec §8): "unauthenticated request to /id/planner
// and /en/planner/informatics/anything both redirect to the matching-locale
// /login, never 200."
//
// No mocking of lib/auth-guard or the database: with DATABASE_URL unset in
// this test environment, auth.api.getSession's underlying query throws, and
// lib/auth-guard.ts's fail-closed design (see its own comment) treats that
// identically to "no session" — so this exercises the real code path, not a
// stand-in for it.
describe("middleware — /planner requires auth", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("redirects an unauthenticated /id/planner request to /id/login", async () => {
    const response = await middleware(makeRequest("/id/planner"));

    expect(response?.status).toBe(307);
    expect(new URL(response!.headers.get("location")!).pathname).toBe(
      "/id/login",
    );
  });

  it("redirects an unauthenticated /en/planner/informatics/anything request to /en/login", async () => {
    const response = await middleware(
      makeRequest("/en/planner/informatics/anything"),
    );

    expect(response?.status).toBe(307);
    expect(new URL(response!.headers.get("location")!).pathname).toBe(
      "/en/login",
    );
  });

  it("never lets an unauthenticated planner request through as a 200", async () => {
    const response = await middleware(makeRequest("/id/planner"));
    expect(response?.status).not.toBe(200);
  });

  it("does not gate non-planner locale routes", async () => {
    // /id/archive isn't in PLANNER_GATED_PREFIXES — should fall through to
    // next-intl's own middleware, not get redirected to /login.
    const response = await middleware(makeRequest("/id/archive"));
    const location = response?.headers.get("location");
    expect(location ? new URL(location).pathname : null).not.toBe("/id/login");
  });
});
