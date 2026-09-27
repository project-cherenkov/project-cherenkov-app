import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

function makeRequest(query = "", cookieHeader?: string): Request {
  return new Request(`http://localhost:3000/api/scene-builder/github-oauth/callback${query}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

describe("GET /api/scene-builder/github-oauth/callback — requires authentication", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("returns 401 for an unauthenticated request, before checking state or exchanging a code", async () => {
    const response = await GET(makeRequest("?code=abc&state=xyz"));
    expect(response.status).toBe(401);
  });

  it("returns 401 even with no query params at all — auth is checked first", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("never returns a redirect (3xx) for an unauthenticated request", async () => {
    const response = await GET(makeRequest("?code=abc&state=xyz"));
    expect(response.status < 300 || response.status >= 400).toBe(true);
  });
});

// F-01 regression: the successful, authenticated path was previously
// untested entirely. This confirms the completed callback never redirects
// off-site even when the stored GITHUB_RETURN_TO_COOKIE request cookie is a
// backslash-based origin-check bypass (`/\evil.example`).
describe("GET /api/scene-builder/github-oauth/callback — returnTo handling", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    process.env.KEYSTATIC_GITHUB_CLIENT_ID = "test-client-id";
    process.env.KEYSTATIC_GITHUB_CLIENT_SECRET = "test-client-secret";
    vi.doMock("@/lib/auth-guard", () => ({
      getCurrentUser: async () => ({ id: "user-1", email: "admin@example.com" }),
    }));
    vi.doMock("@/lib/admin-guard", () => ({
      isAdminEmail: () => true,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ access_token: "gho_test_token" }), { status: 200 })),
    );
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@/lib/auth-guard");
    vi.doUnmock("@/lib/admin-guard");
  });

  it("never redirects off-site when the stored returnTo cookie is a backslash-based origin bypass", async () => {
    const { GET: authenticatedGET } = await import("./route");
    const { createGithubOauthState } = await import("@/lib/scene-builder-oauth");
    const { state, cookieValue } = createGithubOauthState();
    const returnToCookie = encodeURIComponent("/\\evil.example");
    const cookieHeader = `scene_builder_gh_oauth_state=${cookieValue}; scene_builder_gh_return_to=${returnToCookie}`;

    const response = await authenticatedGET(
      makeRequest(`?code=abc123&state=${state}`, cookieHeader),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    const resolved = new URL(location);
    expect(resolved.host).toBe(new URL("http://localhost:3000").host);
    expect(resolved.href).not.toContain("evil.example");
  });
});
