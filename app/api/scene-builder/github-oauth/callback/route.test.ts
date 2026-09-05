import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

function makeRequest(query = ""): Request {
  return new Request(`http://localhost:3000/api/scene-builder/github-oauth/callback${query}`);
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
