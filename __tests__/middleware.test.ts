import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
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

// SCENE-003 required test (spec §11): "/api/scene-builder" joins the
// existing admin-surface gate, matching "/keystatic" and "/api/team-photo"'s
// existing behavior exactly — a production build with no
// KEYSTATIC_GITHUB_CLIENT_ID set 404s the whole write surface.
// "/keystatic/scene-builder" needs no separate ADMIN_SURFACE_PREFIXES entry
// (already covered by the existing "/keystatic" prefix) — asserted here
// anyway since the acceptance criterion is about observed behavior, not
// just the prefixes array.
describe("middleware — admin surface gate covers /api/scene-builder", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("404s /api/scene-builder in production without KEYSTATIC_GITHUB_CLIENT_ID", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "");

    const response = await middleware(makeRequest("/api/scene-builder"));
    expect(response?.status).toBe(404);
  });

  it("404s /keystatic/scene-builder in production without KEYSTATIC_GITHUB_CLIENT_ID", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "");

    const response = await middleware(makeRequest("/keystatic/scene-builder"));
    expect(response?.status).toBe(404);
  });

  it("lets /api/scene-builder through (not a 404) once KEYSTATIC_GITHUB_CLIENT_ID is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "test-client-id");

    const response = await middleware(makeRequest("/api/scene-builder"));
    expect(response?.status).not.toBe(404);
  });
});
