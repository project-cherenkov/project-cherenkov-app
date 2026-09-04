import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/scene-builder/github-oauth/start");
}

describe("GET /api/scene-builder/github-oauth/start — requires authentication", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("returns 401 for an unauthenticated request, before ever redirecting to GitHub", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("never returns a redirect (3xx) for an unauthenticated request", async () => {
    const response = await GET(makeRequest());
    expect(response.status < 300 || response.status >= 400).toBe(true);
  });
});
