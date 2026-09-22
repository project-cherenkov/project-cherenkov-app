// Client-safe counterpart to lib/scene-builder-oauth.ts (which imports
// node:crypto at module scope and so can't be pulled into a client
// bundle — same constraint noted in scene-builder-write.ts re: node:fs).
//
// BUG FIX: app/api/scene-builder/new/route.ts and app/api/scene-builder/
// route.ts both return this exact 401 body when the contributor hasn't
// completed the separate scene-builder GitHub OAuth handshake yet (see
// scene-builder-oauth.ts's design-decision comment for why it's separate
// from Keystatic's own login). Both callers — new-visualization-form.tsx
// and scene-builder-app.tsx — were rendering that message as plain dead-end
// text with no way to act on it; a contributor who doesn't already know to
// hand-type "/api/scene-builder/github-oauth/start" into the address bar is
// stuck. These two helpers let both callers turn the same error into a
// working "Authorize with GitHub" link instead of duplicating the string
// match and URL-building in three places.

/** Matches the shared prefix of both routes' 401 body, deliberately not the
 * full message (route.ts's says "...try saving again", new/route.ts's says
 * "...try again") — this checks for the condition, not the exact copy. */
export function isGithubAuthRequiredError(message: string | null | undefined): boolean {
  return typeof message === "string" && message.startsWith("GitHub authorization required");
}

/** Builds the URL that starts the scene-builder's own GitHub OAuth
 * handshake, carrying `returnTo` so the callback (app/api/scene-builder/
 * github-oauth/callback/route.ts) lands the contributor back where they
 * were instead of its own default (/keystatic/scene-builder). `returnTo`
 * is expected to already be a same-origin path (e.g. from
 * `window.location.pathname + window.location.search`); the start route
 * re-validates it server-side regardless (isSafeReturnTo), so a bad value
 * here just falls back to that default rather than becoming an open
 * redirect. */
export function buildGithubAuthorizeUrl(returnTo: string): string {
  return `/api/scene-builder/github-oauth/start?returnTo=${encodeURIComponent(returnTo)}`;
}
