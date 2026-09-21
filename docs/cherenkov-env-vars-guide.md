# Project Cherenkov — Environment Variables Guide

This document covers every environment variable the app recognizes, what it
unlocks, whether you actually need it, and exactly how to obtain the value —
based on how each variable is used in the codebase (`lib/auth.ts`,
`lib/db/index.ts`, `lib/admin-guard.ts`, `middleware.ts`, `keystatic.config.ts`,
`app/api/team-photo/route.ts`, `app/api/scene-builder/github-oauth/*`) and
`.env.example`.

**The short version:** none of these are required. The public editorial
archive builds and runs with zero environment variables set. Everything below
is opt-in — set only the group(s) that unlock a feature you actually want.

This guide covers **two deployment contexts** side by side under each
variable:

- **Local development** — running the app on your own machine with
  `pnpm dev`, values stored in a `.env.local` file that Next.js loads
  automatically.
- **Vercel deployment** — running the app on Vercel, values stored in the
  Vercel dashboard under **Settings → Environment Variables**.

You can set up either one independently, or both (e.g. test locally first,
then deploy). A few variables need slightly different values or an extra
step depending on which context you're configuring.

---

## Quick reference

| Variable | Unlocks | Required? | Cost |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Correct sitemap/robots/Open Graph URLs | Optional | Free |
| `DATABASE_URL` | Accounts + study planner (Phase 2) | Optional | Free (Neon) |
| `BETTER_AUTH_SECRET` | Required *if* using accounts | With `DATABASE_URL` | Free |
| `BETTER_AUTH_URL` | Required *if* using accounts | With `DATABASE_URL` | Free |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Continue with Google" button | Optional | Free |
| `KEYSTATIC_GITHUB_CLIENT_ID` / `_SECRET` | `/keystatic` admin UI in production | Optional | Free |
| `NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED` | Makes github-storage mode actually activate client-side | With Keystatic vars | Free |
| `KEYSTATIC_SECRET` | Required *if* using Keystatic GitHub mode | With Keystatic vars | Free |
| `KEYSTATIC_GITHUB_REPO` | Which repo Keystatic commits to | Optional (has a default) | Free |
| `ADMIN_EMAILS` | Restricts team-photo uploads to specific editors | Required for team-photo uploads | Free |
| `BLOB_READ_WRITE_TOKEN` | Team-photo upload feature | Optional | Free (Vercel Blob) |

---

## Local vs. Production: at a glance

Not every variable behaves the same way across the two contexts. Some are
meant to be identical, some *can* be identical but are safer kept separate,
and some are structurally different values by nature (like a `localhost`
URL vs a real domain). This table summarizes which is which before you go
variable-by-variable below.

| Variable | Same value in both? | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | No — different by nature | `http://localhost:3000` locally, real domain in production |
| `DATABASE_URL` | Can share, but **recommended separate** | Use a Neon branch for local — protects real user/planner data from local bugs |
| `BETTER_AUTH_SECRET` | Can share, but **recommended separate** | No requirement they match; generating two is slightly better hygiene |
| `BETTER_AUTH_URL` | No — different by nature | Mirrors `NEXT_PUBLIC_SITE_URL`'s local/prod split |
| `GOOGLE_CLIENT_ID` | **Same** — one OAuth client, two registered redirect URIs | Not two separate client IDs; just add both callback URLs to the same client |
| `GOOGLE_CLIENT_SECRET` | **Same** | Comes from the same shared client above |
| `KEYSTATIC_GITHUB_CLIENT_ID` | **Same** — one GitHub App, four registered callback URLs | Unlike classic OAuth Apps (one callback URL each), a GitHub App supports up to 10 — see §6 |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | **Same** | Comes from the one shared GitHub App above |
| `NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED` | **Same** | Plain boolean flag, not a secret — must be set alongside the two above in both contexts or client and server disagree on storage mode |
| `KEYSTATIC_SECRET` | Can share, but **recommended separate** | Self-generated; no cost to making two |
| `KEYSTATIC_GITHUB_REPO` | Same, if set at all | Usually just the one real repo either way |
| `ADMIN_EMAILS` | Usually the same list | Can trim to just your own email locally if you want a smaller test allowlist |
| `BLOB_READ_WRITE_TOKEN` | Can share, but **recommended separate** | Two Blob stores, same variable name, scoped by environment in Vercel |

**Quick summary of what actually requires re-registering something
(vs. just pasting a different value):**

- **Google OAuth** — one registration, add a second redirect URI. No new
  client needed.
- **GitHub App (Keystatic)** — also just one registration. It needs four
  separate callback URLs added to that one App (two routes — Keystatic's
  own login and the scene builder's separate OAuth flow — × two
  environments), but it's still one App, one Client ID/Secret pair, no
  re-registering per environment. See §6 for exactly why it's a *GitHub
  App* and not an OAuth App at all.
- **Database (Neon)** — no new "registration," just create a branch (or a
  second project) and use its own connection string.
- **Blob storage** — no new "registration," just create a second store and
  link it scoped to Development instead of Production.
- **Secrets you generate yourself** (`BETTER_AUTH_SECRET`,
  `KEYSTATIC_SECRET`) — nothing to register at all, just run
  `openssl rand -base64 32` twice.

---

## Where each context stores its values

**Local development:** create a file named `.env.local` in the project
root (same folder as `package.json`). Next.js loads it automatically on
`pnpm dev` — no extra config needed. Never commit this file (it should
already be in `.gitignore`).

**Vercel deployment:** Vercel dashboard → your project → **Settings →
Environment Variables**. Enter the Key and Value, choose which environments
it applies to (Production, Preview, Development), and click **Save**.
Redeploy (or push a new commit) afterward — Vercel does not hot-reload env
var changes into an already-running deployment.

---

## 1. `NEXT_PUBLIC_SITE_URL`

**What it does:** Sets the absolute origin used by `app/sitemap.ts`,
`app/robots.ts`, and Open Graph metadata. Without it, these fall back to
`http://localhost:3000`, which is harmless in dev but wrong once deployed
(social share previews and search engine crawlers need the real URL).

**Required?** No — the site builds and runs fine without it. Set it once you
have a real domain (or, locally, if you just want to sanity-check the
sitemap/OG output).

### Local development

**Value:** `http://localhost:3000` (or omit it entirely — this is already
the fallback).

**How to set it:** Add to `.env.local`:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Vercel deployment

**Value:** `https://project-cherenkov-app.vercel.app`

**How to get it:**

1. Deploy the project to Vercel first (Import → Deploy — no env vars needed
   for this step).
2. Vercel assigns you a domain automatically (`your-project.vercel.app`), or
   you can attach a custom domain under **Settings → Domains**.
3. Copy that domain, add `https://` in front, and set it as the value.

**Where to set it:** Vercel dashboard → **Settings → Environment Variables**.

---

## 2. `DATABASE_URL` (Phase 2 — accounts + planner)

**What it does:** Connection string for the Postgres database that backs
user accounts and the study planner. `lib/db/index.ts` constructs the client
lazily, so without this var, any request to `/planner/**` or `/api/auth/**`
simply fails closed (treated as unauthenticated) rather than crashing the
build.

**Required?** Only if you want accounts/login/planner to work at all.

**Value format (same for both contexts — Neon is a remote service either
way, there's no "local Postgres" step):**

```
postgresql://user:password@ep-example-123456.region.aws.neon.tech/cherenkov?sslmode=require
```

**How to get it (using Neon, a serverless Postgres provider):**

1. Go to [neon.tech](https://neon.tech) and sign up (free, no credit card
   required).
2. Create a new project — pick a name and region close to your Vercel
   deployment region for lower latency.
3. Neon shows a **connection string** immediately after project creation
   (dashboard → your project → **Connection Details**). It looks exactly
   like the format above.
4. Copy that full string as your `DATABASE_URL` value.

**Free tier notes:** Neon's free plan includes 100 projects, 10 branches per
project, 100 CU-hours of compute per project per month, and 0.5 GB of
storage per project — comfortably enough for a small team/passion project,
and commercial use is allowed on the free tier too (not that you need that
here).

### Local development

**How to set it:** Add the connection string to `.env.local`:

```
DATABASE_URL=postgresql://user:password@ep-example-123456.region.aws.neon.tech/cherenkov?sslmode=require
```

You can point local dev at the *same* Neon database you'll use in
production, or create a second Neon project (or a Neon **branch** of the
same project — free tier includes 10 branches) to keep dev data separate
from production data. A branch is usually the more convenient option since
it's a one-click copy of your schema.

### Vercel deployment

**Where to set it:** Vercel dashboard → **Settings → Environment Variables**.

---

## 3. `BETTER_AUTH_SECRET`

**What it does:** Signing secret for Better Auth's session tokens/cookies.
This is a value *you* generate — it's not issued by any external service.

**Required?** Only alongside `DATABASE_URL`, if you want accounts to work.

**How to get it (same command for both contexts):** Generate a random
string yourself:

```bash
openssl rand -base64 32
```

Run that in any terminal (macOS/Linux, or Git Bash / WSL on Windows) and
paste the output as the value.

### Local development

**How to set it:** Add to `.env.local`:

```
BETTER_AUTH_SECRET=<paste generated value here>
```

You can generate a *different* secret for local dev than for production —
there's no requirement they match, and it's slightly better hygiene if they
don't.

### Vercel deployment

**Where to set it:** Vercel dashboard → **Settings → Environment Variables**.
Treat it like a password — don't commit it to the repo.

---

## 4. `BETTER_AUTH_URL`

**What it does:** Tells Better Auth the base URL of your deployed app (used
to construct OAuth callback URLs and validate redirects).

**Required?** Only alongside `DATABASE_URL`.

### Local development

**Value:** `http://localhost:3000`

**How to set it:** Add to `.env.local`:

```
BETTER_AUTH_URL=http://localhost:3000
```

### Vercel deployment

**Value:** `https://project-cherenkov-app.vercel.app` — same
value as `NEXT_PUBLIC_SITE_URL`, just as its own variable since Better Auth
reads it independently.

**Where to set it:** Vercel dashboard → **Settings → Environment Variables**.

---

## 5. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

**What it does:** Enables the "Continue with Google" button on
login/signup. `app/[locale]/login/page.tsx` and `signup/page.tsx` only
render that button when *both* vars are present — email/password sign-in
always works regardless.

**Required?** No — purely additive. Skip if email/password login is enough.

**Cost:** Completely free, no trial or billing account needed — ignore any
"$300 free credit" banner Google Cloud shows you. That trial covers metered
products (compute, paid APIs, etc.). Creating OAuth credentials for a login
button isn't a billable action and works with zero billing setup.

**How to get it** (current UI is called **Google Auth Platform**) — this
setup is shared between both contexts, since it's the same OAuth client
either way. The only difference is which redirect URI(s) you register.

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click **"Create project"** (top project dropdown). Give it any name, e.g.
   "Project Cherenkov" — this is just a label and doesn't need to match
   anything else. Leave **Parent resource / Organization** as
   **"No organization"** — that's correct for a personal Google account (it
   only matters if you're on a managed Google Workspace domain). Click
   **Create**.
3. In the left sidebar (Google Auth Platform), go to **Branding** — this
   replaced the old "OAuth consent screen" step. Choose **External** user
   type, fill in app name + your email as support contact, save. "Testing"
   publishing status is fine for a small team — just add your Google
   accounts under **Audience → Test users**.
4. Go to **Clients** in the sidebar (replaced "Credentials") → **Create
   Client** → Application type: **Web application**.
5. Under **Authorized redirect URIs**, add *both* of the following (one
   OAuth client can hold multiple redirect URIs — you don't need a separate
   client per environment):

   ```
   https://project-cherenkov-app.vercel.app/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```

   (this is Better Auth's standard callback path, confirmed in `lib/auth.ts`).
   Optionally also add an **Authorized JavaScript origin** of
   `https://project-cherenkov-app.vercel.app` (no trailing path) — not
   strictly required for Better Auth's flow, but harmless to include.
6. Click **Create**. Google shows a **Client ID** (ends in
   `.apps.googleusercontent.com`) and a **Client Secret** — copy both. The
   same pair of values is used in both `.env.local` and Vercel.

### Local development

**How to set it:** Add to `.env.local`:

```
GOOGLE_CLIENT_ID=<paste client id>
GOOGLE_CLIENT_SECRET=<paste client secret>
```

Google sign-in will now work at `http://localhost:3000` as long as the
localhost redirect URI above is registered.

### Vercel deployment

**Where to set them:** Vercel dashboard → **Settings → Environment
Variables**.

---

## 6. `KEYSTATIC_GITHUB_CLIENT_ID` / `KEYSTATIC_GITHUB_CLIENT_SECRET` / `NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED`

**What these do:** Without `KEYSTATIC_GITHUB_CLIENT_ID` set,
`keystatic.config.ts` falls back to `{ kind: "local" }` — local-storage mode
with **no authentication**, which is why `lib/admin-guard.ts` + `middleware.ts`
block `/keystatic`, `/api/keystatic/*`, `/api/team-photo`, and
`/api/scene-builder/*` entirely in a production build until it's set.
Setting it switches Keystatic to "github-storage" mode, where GitHub access
control becomes real: edits land as commits, gated by whether the logged-in
user actually has write access to the repo.

`NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED` has to be set *alongside* it, for a
subtler reason: `keystatic.config.ts` is imported by a `"use client"`
component, so it's bundled into the **browser**, not just the server.
`KEYSTATIC_GITHUB_CLIENT_ID` is server-only — Next.js never inlines a value
for it into client code, so in the browser it always reads as `undefined`.
That means the *browser* decides local-vs-github storage from this separate
`NEXT_PUBLIC_`-prefixed flag instead, independently of what the server
decides. Set all three together, or you get a real bug, not just a
misconfiguration: the server runs in github mode while the browser silently
stays in local mode, and collections 404 while singleton pages just spin
forever.

**These need a real GitHub App — not an OAuth App.** Keystatic's own GitHub
login (`@keystatic/core`'s `githubLogin` function) never sends an OAuth
`scope` parameter when it redirects to GitHub. That's fine for a GitHub App,
where write access comes from the App's configured permissions plus which
repo it's installed on, not from OAuth scopes at all — but point a classic
OAuth App's Client ID/Secret at this same flow and the resulting token gets
*zero* scopes, and every save fails with a GraphQL error like:

```
Your token has not been granted the required scopes to execute this query.
The 'createCommitOnBranch' field requires one of the following scopes:
['public_repo'], but your token has only been granted the: [''] scopes.
```

**Required?** Only if you want the `/keystatic` admin UI reachable in a
*deployed, production* build. If your team is fine editing MDX files
directly and pushing to GitHub, skip this entirely — the archive works
identically either way.

**Local dev doesn't need any of this to reach `/keystatic` at all.**
Confirmed directly from `lib/admin-guard.ts`:

```ts
export function isAdminSurfaceEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(process.env.KEYSTATIC_GITHUB_CLIENT_ID);
}
```

`pnpm dev` always runs with `NODE_ENV !== "production"`, so `/keystatic` is
reachable locally regardless — in Keystatic's local-storage mode, no GitHub
auth involved, edits go straight to your working copy. You'd only set these
vars locally if you specifically want to test the real github-storage flow
(e.g. verifying the OAuth callback) before deploying.

**One GitHub App covers both contexts.** Unlike classic OAuth Apps (exactly
one callback URL each), a GitHub App supports up to 10 registered callback
URLs — GitHub matches whichever one the request's `redirect_uri` param
names. This project needs **four** registered, not two, because two
separate routes each run their own independent GitHub OAuth handshake with
their own callback path:

```
http://localhost:3000/api/keystatic/github/oauth/callback
https://project-cherenkov-app.vercel.app/api/keystatic/github/oauth/callback
http://localhost:3000/api/scene-builder/github-oauth/callback
https://project-cherenkov-app.vercel.app/api/scene-builder/github-oauth/callback
```

(Keystatic's own admin login uses the first path; the scene builder's
separate hand-rolled flow — `app/api/scene-builder/github-oauth/start` and
`/callback` — uses the second, and already explicitly requests `scope:
"repo"` on its own authorize call, which GitHub simply ignores for a GitHub
App without causing any error.) Both routes build their redirect
dynamically from the incoming request's own origin, so as long as the
matching URL is registered, GitHub resolves correctly whichever environment
the request came from — you don't need separate credentials per
environment, just the extra registered URLs.

**How to get it:**

1. **Decide which account should own it.** If `project-cherenkov` on GitHub
   is an organization (not just a personal account name), create the App
   under the org — `github.com/organizations/project-cherenkov/settings/apps/new`
   — rather than a personal account, so any org owner can manage it later
   instead of it being tied to one person. This needs org-owner (or
   App-manager) permissions; otherwise use your personal account's
   equivalent page at `github.com/settings/apps/new`.
2. Click **New GitHub App**. Name it something identifiable (must be
   globally unique across GitHub, e.g. "Project Cherenkov CMS"). Homepage
   URL can just be the production URL — this field isn't security-relevant
   even for the local-dev use of the same App.
3. Under **Identifying and authorizing users**, add all **four** callback
   URLs listed above (click "Add callback URL" for each one after the
   first).
4. Under **Webhook**, uncheck **Active** — Keystatic doesn't use webhooks.
5. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**. (Metadata: Read-only gets added automatically.)
6. Leave **Enable Device Flow** unchecked.
7. **Leave "Expire user authorization tokens" checked.** This isn't just
   GitHub's general security recommendation — it's mandatory for this
   specific codebase. `@keystatic/core`'s own callback handler validates
   GitHub's token response against a schema requiring `expires_in`,
   `refresh_token`, and `refresh_token_expires_in` to all be present.
   Those fields only exist in GitHub's response when token expiration is
   turned on; a non-expiring token's response is just
   `{access_token, token_type, scope}`. Uncheck this box and every
   `/keystatic` login attempt fails that schema check and returns a flat
   `401 Authorization failed` — Keystatic's own automatic
   `/api/keystatic/github/refresh-token` endpoint is what silently renews
   the token using the refresh token before the 8-hour access token
   expires, so nothing further is needed from you here.
8. Under **Where can this GitHub App be installed?**, choose **Only on
   this account**.
9. Click **Create GitHub App**. On the resulting settings page, scroll to
   **Client secrets** → **Generate a new client secret** and copy it
   immediately (shown once). Copy the **Client ID** from higher up the
   page too.
10. Click **Install App** in the left sidebar, and install it on
    `project-cherenkov/project-cherenkov-app`. The App has no actual repo
    access until this step, no matter what permissions you configured —
    permissions and installation are separate.

**Cost:** Free — creating and installing a GitHub App doesn't require
GitHub Pro/Team and has no usage limits.

### Local development

**How to set it:** Add all three to `.env.local`:

```
KEYSTATIC_GITHUB_CLIENT_ID=<paste client id>
KEYSTATIC_GITHUB_CLIENT_SECRET=<paste client secret>
NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED=true
```

Set all three together or none — setting only the first two reproduces the
client/server storage-mode mismatch described above.

### Vercel deployment

**How to set it:** The exact same three variables, same values — there's no
separate production App or separate credentials to obtain; it's the one
App created above, already installed on the repo.

**Where to set them:** Vercel dashboard → **Settings → Environment
Variables**.

---

## 7. `KEYSTATIC_SECRET`

**What it does:** Signing secret Keystatic uses internally for its own
session handling in github-storage mode.

**Required?** Only alongside the `KEYSTATIC_GITHUB_*` vars above.

**How to get it (same command for both contexts):** Same approach as
`BETTER_AUTH_SECRET` — generate it yourself:

```bash
openssl rand -base64 32
```

### Local development

**How to set it:** Add to `.env.local`:

```
KEYSTATIC_SECRET=<paste generated value here>
```

### Vercel deployment

**Where to set it:** Vercel dashboard → **Settings → Environment
Variables**.

---

## 8. `KEYSTATIC_GITHUB_REPO`

**What it does:** Tells Keystatic which GitHub repo to read/write content
from in github-storage mode.

**Required?** No — `keystatic.config.ts` already defaults to
`project-cherenkov/project-cherenkov-app`, which is presumably your actual
repo. Only set this explicitly if you're using a different repo (e.g. a
personal fork), and this applies identically to local and Vercel.

**Value:** `owner/repo-name` format, e.g. `your-org/your-repo`.

### Local development

**How to set it (only if overriding the default):** Add to `.env.local`:

```
KEYSTATIC_GITHUB_REPO=your-org/your-repo
```

### Vercel deployment

**Where to set it:** Vercel dashboard → **Settings → Environment
Variables** (only if overriding the default).

---

## 9. `ADMIN_EMAILS`

**What it does:** A comma-separated allowlist of editor emails allowed to
upload team photos. `app/api/team-photo/route.ts` checks `getCurrentUser()`
first, then calls `isAdminEmail(user.email)` before it will accept the upload.
This is a separate authorization gate from the Keystatic GitHub App setup.

**Required?** Only for the team-photo upload route when you want to restrict
who can upload. If the value is unset or empty, no authenticated user is
allowed through this check.

**Value format (same for both contexts):**

```
editor@example.com, another-editor@example.com, team-lead@example.com
```

The app lowercases and trims the values, so spacing and casing are not
important.

### Local development

**How to set it:** Add to `.env.local`, typically your own email so you can
test the upload flow:

```
ADMIN_EMAILS=you@example.com
```

### Vercel deployment

**Where to set it:** Vercel dashboard → **Settings → Environment Variables.**

---

## 10. `BLOB_READ_WRITE_TOKEN`

**What it does:** Authorizes `app/api/team-photo/route.ts` to upload files
to Vercel Blob storage — this powers the team-photo upload feature in the
Keystatic admin UI.

**Required?** Only if you want that specific upload path to work. Everything
else in the app is unaffected if it's unset. Also, even with a Blob token
set, the request still fails with `403` unless the signed-in user email is in
`ADMIN_EMAILS`.

**How to get it (this is a Vercel-hosted service regardless of where the
app itself is running):**

1. In the Vercel dashboard, open your project → **Storage** tab.
2. Click **Create Database** (or **Create Store**) → choose **Blob**. Give
   it a name (e.g. `project-cherenkov-app-blob`) and pick a region — this
   can't be changed later, so ideally match your deployment's region, but
   any region works fine functionally.
3. **Access: choose Public, not Private.** Team photos are meant to be
   displayed on the site, not sensitive data — Public means uploaded photo
   URLs work directly. Private would require a signed-token round trip just
   to *display* a photo, which adds complexity for no benefit here.
4. **Custom Environment Variable Prefix: leave it as `BLOB`.** The code
   specifically checks `process.env.BLOB_READ_WRITE_TOKEN`, so this prefix
   must not be changed.
5. **Check the box "Add a read-write token env var to this connection."**
   This is the step that actually creates `BLOB_READ_WRITE_TOKEN`. Without
   it, you'd only get `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY`, neither
   of which the app reads — the upload route would stay non-functional.
6. Vercel prompts you to **link** the store to a project — select your
   Cherenkov project, and choose which environments this link applies to
   (Production / Preview / Development — see the note on separate stores
   below for why this choice matters).

**Should you use one store for both contexts, or separate stores?** Either
works, but they carry different risk profiles:

- **One shared store (simplest):** the same token in `.env.local` and
  Vercel. Fine for a low-stakes feature like team photos, but local test
  uploads land in the same storage your live site serves from — you'll
  accumulate test files, and a local bug could touch real content.
- **Two separate stores (safer, still free):** create a second store (e.g.
  `project-cherenkov-app-blob-dev`) purely for local testing. Vercel Hobby
  allows up to 100 stores, so this costs nothing.

If you go with two separate stores, a few things to get right:

- **Do** use Vercel's per-environment scoping when linking each store:
  link the production store to the **Production** environment only, and
  the dev store to **Preview + Development** only. Both stay named
  `BLOB_READ_WRITE_TOKEN` — Vercel just resolves a different value
  depending on environment — so no code changes are needed.
- **Don't** link both stores to the same environment scope (e.g. both to
  "Production," or both unscoped). Vercel will either reject the second
  link or auto-suffix the variable name (e.g. `BLOB_READ_WRITE_TOKEN_2`),
  which the code won't pick up since it reads the exact name
  `BLOB_READ_WRITE_TOKEN`.
- **Don't** rename the variable yourself to tell the two apart —
  `app/api/team-photo/route.ts` has that exact name hardcoded.

### Local development

Once the store exists and is linked (done one-time in the Vercel dashboard
regardless of where you run the app), you need the token value locally too.
Vercel's "Development" environment scope governs what `vercel env pull`
fetches — it is not automatically the same as your local `.env.local` file,
so you still need to pull or copy the value yourself.

**How to get the value:**
- Vercel dashboard → **Settings → Environment Variables** → find
  `BLOB_READ_WRITE_TOKEN` → reveal and copy it (if you used two stores,
  make sure you're copying the one scoped to Development, not Production).
- Or, via the Vercel CLI: `vercel env pull .env.local` pulls your project's
  scoped Development env vars directly into a local `.env.local` file.

**How to set it manually:** Add to `.env.local`:

```
BLOB_READ_WRITE_TOKEN=<paste copied token>
```

If you're using a separate dev store, remember the team-photo upload route
also checks `ADMIN_EMAILS` independently — make sure your own email is
listed there locally too, or the upload will still 403 regardless of which
Blob store is configured.

### Vercel deployment

**Where it's set:** Automatically, by linking the store in step 6 above —
not manually typed. Trigger a redeploy so the running app picks it up.

**To confirm:** **Settings → Environment Variables** should show
`BLOB_READ_WRITE_TOKEN` listed (and, if using two stores, confirm it's
scoped to Production and shows the production store's value, not the dev
one).

**Free tier notes:** Vercel Hobby includes 1 GB of Blob storage and 10 GB of
Blob transfer per month, plus up to 100 separate Blob stores — enough
headroom to run a fully separate store for local/dev testing at no cost.

---

## Summary: setting variables in each context

**Local development**

1. Create (or open) `.env.local` in the project root.
2. Add each `KEY=value` pair on its own line, no quotes needed unless the
   value itself contains spaces.
3. Restart `pnpm dev` after adding or changing values — Next.js reads
   `.env.local` at startup, not live.

**Vercel deployment**

1. Open your project in the [Vercel dashboard](https://vercel.com/dashboard).
2. Go to **Settings → Environment Variables**.
3. For each variable: enter the **Key** (exact name, e.g. `DATABASE_URL`)
   and **Value**, choose which environments it applies to (Production,
   Preview, Development — usually all three), and click **Save**.
4. Redeploy the project (or push a new commit) for the variables to take
   effect — Vercel does not hot-reload env var changes into an already-running
   deployment.

---
