// Single source of truth for whether the CMS "write surface" — the
// Keystatic admin UI, its API route, and the team-photo upload path — is
// reachable at all.
//
// DEPLOYMENT-READINESS FIX, not part of the original spec: local-storage
// Keystatic (the default when KEYSTATIC_GITHUB_CLIENT_ID isn't set — see
// keystatic.config.ts) has no authentication of its own. That's fine in
// `pnpm dev` (only the person running the dev server can reach it), but on
// a real deployment nothing else guards it — see the "Remaining Risks"
// comments this fix resolves in app/keystatic/team-photo/page.tsx and
// components/site/team-photo-uploader.tsx. Two concrete exposures if this
// guard didn't exist:
//   1. /keystatic would serve a fully-functional-looking CMS UI to any
//      visitor, whose edits silently vanish (serverless filesystems don't
//      persist), which is confusing at best.
//   2. app/api/team-photo/route.ts needs its own caller authorization because
//      the middleware gate only answers whether the surface is enabled.
//
// Conservative decision (flagged, not silently chosen): once
// KEYSTATIC_GITHUB_CLIENT_ID is set, GitHub OAuth + repo write access
// becomes real access control for /keystatic — at that point this guard
// gets out of the way and defers to it. Until then, "deployed" and
// "actually authenticated" are treated as mutually exclusive. If that's
// wrong for your situation (e.g. you want local-storage mode reachable on
// a preview deploy), override by setting KEYSTATIC_GITHUB_CLIENT_ID, or
// relax this function — don't route around it silently.
export function isAdminSurfaceEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(process.env.KEYSTATIC_GITHUB_CLIENT_ID);
}

// Team-photo authorization is deliberately explicit and independent of the
// CMS surface toggle. Values are comma-separated emails, normalized so the
// deployment setting is not sensitive to whitespace or casing.
export function isAdminEmail(email: string): boolean {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
