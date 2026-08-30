import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail } from "@/lib/admin-guard";
import { sanitizeBlobPathSegment } from "./sanitize";

// BLOB-002 (team-photo path) + BLOB-004 (upload constraints).
//
// This is intentionally NOT wired through a Keystatic image field — see the
// comment on the `team` singleton in keystatic.config.ts for why. A team
// member uploads a photo here first, gets back a public Blob URL, then
// pastes that URL into the team singleton's photoUrl field in /keystatic.
//
// Constraints enforced BEFORE any network call to Blob, per BLOB-004:
//   - images only (checked by MIME type)
//   - 5MB max (conservative default — no existing size precedent in the
//     codebase to match against, so this is not a hard requirement carried
//     over from anywhere, just a sane cap)
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  // SEC-001 / TICKET-04: a per-request session check, independent of
  // middleware.ts's isAdminSurfaceEnabled() env-level gate (which answers
  // "is the admin surface turned on at all", not "is *this caller*
  // authenticated"). Checked before touching the request body or calling
  // Blob's put(), same fail-closed getCurrentUser() every other per-user
  // Server Action already uses (lib/quiz-actions.ts, lib/planner-actions.ts).
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: "Content editor authorization required." },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided." },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || "unknown"}. Images only.` },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max is 5MB.` },
      { status: 400 },
    );
  }

  // BLOB-003 precondition: BLOB_READ_WRITE_TOKEN must exist before this
  // path is exercised for real. Fail clearly rather than letting put()
  // throw an opaque error if it's missing.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN is not set. See .env.example — do not test this route until the Blob store exists and the token is configured.",
      },
      { status: 503 },
    );
  }

  const safeFileName = sanitizeBlobPathSegment(file.name);
  const blob = await put(`team/${Date.now()}-${safeFileName}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
