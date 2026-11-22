// Tokens for the personal calendar feed. The token is the whole credential, so
// only its SHA-256 hash is stored: a database read cannot reveal a usable link.
import { createHash, randomBytes } from "node:crypto";

// 32 random bytes = 256 bits, base64url = 43 characters.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function generateFeedToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashFeedToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isWellFormedFeedToken(value: string): boolean {
  return TOKEN_RE.test(value);
}

/** The last path segment may carry a ".ics" suffix; apps like links that end in it. */
export function tokenFromSegment(segment: string): string {
  return segment.endsWith(".ics") ? segment.slice(0, -4) : segment;
}
