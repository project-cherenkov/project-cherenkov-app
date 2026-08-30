import { describe, expect, it, beforeEach } from "vitest";
import { POST, sanitizeBlobPathSegment } from "./route";

// SEC-001 / TICKET-04 required test: an unauthenticated POST to
// /api/team-photo must be rejected before any file handling or Blob call,
// both when the admin surface is enabled and disabled at the environment
// level (isAdminSurfaceEnabled() is an outer, env-level gate in
// middleware.ts — this route's own per-request session check is the inner
// one this ticket adds).
//
// Same no-mocking approach as __tests__/middleware.test.ts: with
// DATABASE_URL unset, auth.api.getSession's underlying query throws, and
// lib/auth-guard.ts's fail-closed design treats that identically to "no
// session" — so this exercises the real getCurrentUser() code path.
function makeRequest(): Request {
  const form = new FormData();
  form.set(
    "file",
    new File(["fake-image-bytes"], "photo.jpg", { type: "image/jpeg" }),
  );
  return new Request("http://localhost:3000/api/team-photo", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/team-photo — requires authentication", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("returns 401 for an unauthenticated request", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
  });

  it("never returns 200 for an unauthenticated request", async () => {
    const response = await POST(makeRequest());
    expect(response.status).not.toBe(200);
  });
});

describe("sanitizeBlobPathSegment", () => {
  it("removes path traversal and unsafe filename characters", () => {
    expect(sanitizeBlobPathSegment("../../team photo?.jpg")).toBe(
      "team-photo.jpg",
    );
    expect(sanitizeBlobPathSegment("..\\..\\avatar.png")).toBe(
      "avatar.png",
    );
    expect(sanitizeBlobPathSegment("    ")).toBe("upload");
  });
});
