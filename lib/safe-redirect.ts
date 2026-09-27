// Canonical definition of the same-origin "is this returnTo/nextPath value
// safe to redirect to" check, shared by both the scene-builder GitHub OAuth
// flow (lib/scene-builder-oauth.ts, which re-exports this) and
// components/auth/login-form.tsx (a Client Component, which is why this
// logic lives in its own module with no Node-only imports rather than
// inside lib/scene-builder-oauth.ts itself).
//
// F-01 / F-02 fix: the previous check at both call sites was
// `value.startsWith("/") && !value.startsWith("//")`, which accepts values
// like `/\evil.example`. Browsers (and `new URL(value, origin)`) treat a
// leading backslash the same as a leading slash, so `/\evil.example`
// resolves to the external origin `https://evil.example` — a same-origin
// check bypass. Rejecting any value containing a backslash anywhere closes
// this without needing to fully resolve the URL.
export function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  return true;
}
