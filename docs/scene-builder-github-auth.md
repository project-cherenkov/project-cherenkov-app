# Authorizing the scene builder's GitHub access

For whoever hits **"GitHub authorization required. Visit
/api/scene-builder/github-oauth/start, then try again."** while using
`/keystatic/scene-builder` (either its "New visualization" flow or "Save to
editorial") on a deployed build. This is a normal, expected step — not a
misconfiguration — the first time you use the scene builder in a given
authorization window, and again every time that window expires.

## Why this happens

The scene builder writes files to GitHub, and needs your own GitHub
authorization to do it — but this is a **second, separate** authorization
from the one you already did to get into `/keystatic` itself. Logging into
Keystatic does not also authorize the scene builder.

Two independent OAuth handshakes exist on purpose (see [README §VII, "The
authoring tool"](../README.md#the-authoring-tool-keystaticscene-builder)):

- **Keystatic's own login** — handled entirely inside `@keystatic/core`,
  the moment you open `/keystatic`. This is what already worked if you can
  see the dashboard and its collections.
- **The scene builder's own login** (`app/api/scene-builder/github-oauth/
  {start,callback}/route.ts`, `lib/scene-builder-oauth.ts`) — a small,
  hand-rolled OAuth flow, kept deliberately separate so its temporary
  token never needs a schema migration onto the durable user/session
  tables Better Auth owns. It stores its own GitHub access token in its
  own short-lived (1 hour), HMAC-signed, `httpOnly` cookie — once that
  cookie expires or is absent, any save attempt gets the 401 above.

## How to authorize

1. Make sure you're already logged into the site as an admin (an account
   whose email is in `ADMIN_EMAILS`) — the scene builder's OAuth start
   route checks this before doing anything else.
2. If the error appeared inline in the scene builder UI, click the
   **"Authorize with GitHub"** link it shows — it carries you through step
   3 below and brings you back to the same page afterward. If you're doing
   this proactively (or the link isn't available for some reason), visit
   directly:
   ```
   https://project-cherenkov-app.vercel.app/api/scene-builder/github-oauth/start
   ```
   (`http://localhost:3000/...` in local GitHub-mode development.)
3. Approve access on GitHub's consent screen.
4. You're redirected back automatically. Retry the create/save action —
   it should go through now.

You'll need to repeat this once the hour-long token expires — again, not a
bug, just how long the cookie is deliberately kept alive for.

## Troubleshooting

If step 3 itself fails, or saving still fails after a successful
authorization, check these in order:

1. **Your email is in `ADMIN_EMAILS`.** Same allowlist `/api/team-photo`
   uses (`lib/admin-guard.ts`) — a mismatch here fails before you ever
   reach GitHub, with a 403 rather than the 401 above.
2. **`KEYSTATIC_GITHUB_CLIENT_ID`, `_SECRET`, and `KEYSTATIC_SECRET` are set
   on the deployment.** The scene builder reuses these exact three env
   vars rather than provisioning its own — if Keystatic's own login
   already works, these are already confirmed fine and you can skip this
   check.
3. **The GitHub App's redirect URIs match exactly.** Under the App's
   *Identifying and authorizing users* settings, all four of these need to
   be registered (two per environment, one per OAuth flow):
   - `https://project-cherenkov-app.vercel.app/api/keystatic/github/oauth/callback`
   - `https://project-cherenkov-app.vercel.app/api/scene-builder/github-oauth/callback`
   - `http://localhost:3000/api/keystatic/github/oauth/callback`
   - `http://localhost:3000/api/scene-builder/github-oauth/callback`
   A mismatch here shows up as GitHub itself rejecting the callback (a
   `redirect_uri_mismatch`-style error on GitHub's own page), not the
   cookie-missing 401 this guide opened with — but worth ruling out if
   step 3 above never gets you back to the site at all.
   "Request user authorization (OAuth) during installation" and "Enable
   Device Flow" on that same settings page are unrelated to this flow —
   leaving both unchecked is fine.
4. **The GitHub App has `Contents: Read and write` repository permission**,
   and is installed on this specific repo (not just the account/org). This
   is what actually lets a save commit a new branch, once authorization
   itself has succeeded.
5. **`Expire user authorization tokens` is checked** on the App's
   settings. Required for Keystatic's own login too, so if that already
   works, this is already fine.

## Reference

| Piece | Where |
| --- | --- |
| Start / callback routes | `app/api/scene-builder/github-oauth/{start,callback}/route.ts` |
| Token signing/reading, cookie name, TTL | `lib/scene-builder-oauth.ts` |
| Where the 401 is raised | `app/api/scene-builder/route.ts` (save), `app/api/scene-builder/new/route.ts` (create) |
| Client-side detection + "Authorize with GitHub" link | `lib/scene-builder-oauth-client.ts`, used from `components/site/scene-builder/new-visualization-form.tsx` and `scene-builder-app.tsx` |
| Admin allowlist | `lib/admin-guard.ts`, `ADMIN_EMAILS` |
| Env var reference | `docs/cherenkov-env-vars-guide.md` |
