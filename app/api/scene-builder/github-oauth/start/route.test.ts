import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({
  getCurrentUser: async () => ({ id: "user-1", email: "admin@example.com" }),
}));
vi.mock("@/lib/admin-guard", () => ({
  isAdminEmail: () => true,
}));

import { GET } from "./route";

function makeRequest(query = ""): Request {
  return new Request(
    `http://localhost:3000/api/scene-builder/github-oauth/start${query}`,
  );
}

describe("GET /api/scene-builder/github-oauth/start — requires authentication", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    process.env.KEYSTATIC_GITHUB_CLIENT_ID = "test-client-id";
  });

  it("returns 401 for an unauthenticated request, before ever redirecting to GitHub", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(307);
    expect(response.headers.get("location") ?? "").toContain("github.com/login/oauth/authorize");
  });

  it("never redirects to an external URL when returnTo is untrusted", async () => {
    const response = await GET(makeRequest("?returnTo=https://evil.example"));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("github.com/login/oauth/authorize");
    expect(location).not.toContain("evil.example");
  });

  // F-01 regression: `/\evil.example` used to pass the old
  // `startsWith("/") && !startsWith("//")` check, and `new URL(value, origin)`
  // resolves a leading-backslash value to the external origin. Confirm the
  // cookie set for the eventual post-OAuth redirect never carries that value.
  it("falls back to the safe default returnTo when the value is a backslash-based origin bypass", async () => {
    const response = await GET(makeRequest("?returnTo=/%5Cevil.example"));
    const cookie = response.cookies.get("scene_builder_gh_return_to");
    expect(cookie?.value).toBe("/keystatic/scene-builder");
    const resolved = new URL(cookie?.value ?? "", "https://project-cherenkov.example");
    expect(resolved.origin).toBe("https://project-cherenkov.example");
  });
});
