import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

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

  const blob = await put(`team/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
