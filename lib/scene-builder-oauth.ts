import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Design decision (left open by the architect's spec as "use your
// judgment, document it"): GitHub-mode write-back needs somewhere to keep
// the contributor's GitHub OAuth access token between the OAuth redirect
// and the eventual save. Two existing sessions were deliberately *not*
// reused for this:
//   - Keystatic's own admin-UI session — it's Keystatic's internal state,
//     not meant to be read or extended by application code.
//   - Better Auth's DB-backed session (lib/auth.ts) — reusing it would
//     mean a schema migration and coupling a temporary, deployment-mode-
//     specific OAuth token to the durable user/session tables, for a
//     token that's irrelevant in local-storage mode entirely.
// Instead: a small HMAC-signed, httpOnly, short-lived cookie of its own,
// signed with the already-configured KEYSTATIC_SECRET (Decision B's
// rationale — "reuse already-configured env vars" — applies here too, so
// no new secret needs provisioning). This module only does the pure
// sign/verify math; app/api/scene-builder/github-oauth/*/route.ts owns the
// actual Set-Cookie / Cookie header plumbing.
export const GITHUB_TOKEN_COOKIE = "scene_builder_gh_token";
export const GITHUB_OAUTH_STATE_COOKIE = "scene_builder_gh_oauth_state";
export const GITHUB_RETURN_TO_COOKIE = "scene_builder_gh_return_to";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — "short-lived" per the design note above
const STATE_TTL_MS = 10 * 60 * 1000; // just long enough to complete the GitHub redirect round trip

function secret(): string {
  return process.env.KEYSTATIC_SECRET ?? "dev-insecure-scene-builder-secret";
}

interface SignedPayload<T> {
  v: T;
  exp: number;
}

function sign<T>(value: T, ttlMs: number): string {
  const payload: SignedPayload<T> = { v: value, exp: Date.now() + ttlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${mac}`;
}

function unsign<T>(signed: string | undefined | null): T | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;
  const payloadB64 = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);

  const expectedMac = createHmac("sha256", secret()).update(payloadB64).digest("base64url");
  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expectedMac);
  if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) return null;

  let payload: SignedPayload<T>;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SignedPayload<T>;
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload.v;
}

export function createGithubOauthState(): { state: string; cookieValue: string } {
  const state = randomBytes(16).toString("hex");
  return { state, cookieValue: sign(state, STATE_TTL_MS) };
}

// CSRF check for the OAuth callback: the state GitHub echoes back must
// match the one we minted and stashed in a cookie only we could set.
export function verifyGithubOauthState(cookieValue: string | undefined, state: string | undefined): boolean {
  if (!state) return false;
  const stored = unsign<string>(cookieValue);
  return stored !== null && stored === state;
}

export function signGithubToken(token: string): string {
  return sign(token, TOKEN_TTL_MS);
}

export function readGithubToken(cookieValue: string | undefined): string | null {
  return unsign<string>(cookieValue);
}

export function readCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
