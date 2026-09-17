import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "./route";
import { matchesImageMagicBytes } from "./magic-bytes";
import { sanitizeBlobPathSegment } from "./sanitize";

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

// CH-07 (architect audit round 1): a spoofed `Content-Type` alone must not
// be enough to pass validation — the actual bytes must match a known image
// signature too.
describe("matchesImageMagicBytes", () => {
  it("accepts real PNG, JPEG, GIF, and WEBP signatures", () => {
    expect(matchesImageMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(matchesImageMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(matchesImageMagicBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe(true);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(matchesImageMagicBytes(webp)).toBe(true);
  });

  it("rejects a non-image file with a spoofed image Content-Type", () => {
    const fakeBytes = new TextEncoder().encode("<html><body>not an image</body></html>");
    expect(matchesImageMagicBytes(fakeBytes)).toBe(false);
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
