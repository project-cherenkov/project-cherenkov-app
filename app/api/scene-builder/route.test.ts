import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";

// Same no-mocking approach as app/api/team-photo/route.test.ts and
// __tests__/middleware.test.ts: with DATABASE_URL unset, getCurrentUser()
// fails closed to "no session" via its own try/catch around next/headers,
// so this exercises the real code path rather than a mocked one.
function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/scene-builder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  subject: "physics",
  slug: "projectile-range-symmetry",
  vizConfig: {
    canvas: { widthPx: 320, heightPx: 200 },
    elements: [{ id: "el1", templateId: "shape-circle", params: {} }],
  },
};

describe("POST /api/scene-builder — requires authentication", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("returns 401 for an unauthenticated request, before touching the filesystem", async () => {
    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(401);
  });

  it("never returns 200 for an unauthenticated request", async () => {
    const response = await POST(makeRequest(validBody));
    expect(response.status).not.toBe(200);
  });

  it("returns 401 even for a malformed body — auth is checked first", async () => {
    const response = await POST(makeRequest({ nonsense: true }));
    expect(response.status).toBe(401);
  });
});
