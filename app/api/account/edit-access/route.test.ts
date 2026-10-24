import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

// Same no-mocking approach as the scene-builder route tests: with DATABASE_URL
// unset, getCurrentUser() fails closed to "no session".
describe("GET /api/account/edit-access", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("answers canEdit:false, uncached, for a visitor with no session", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ canEdit: false });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
