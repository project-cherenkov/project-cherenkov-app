# Deployment readiness — Phase 1

Written against the "Feature Architect" process used elsewhere in this repo
(see the `spec §…`, `BLOB-…`, `CMS-…` comments throughout the codebase).
Feature request: **"get Project Cherenkov ready for deployment."**

## 1. Feature summary

Phase 1 is a public, no-login editorial archive. The README already states
it correctly: *"Built for Vercel. Push to GitHub, import the repo in
Vercel, no environment variables needed for Phase 1."* That claim is true
— nothing in this pass contradicts it.

What this pass found is that "ready for deployment" actually splits into
two independent questions with different answers:

- **Is the code safe and correct to put on the public internet?** Mostly
  yes, with one real gap (§3 below) that this pass closes.
- **Is the site ready for a real visitor to land on?** No — several
  user-visible strings are still literally `[PLACEHOLDER — ...]` text
  (§5). That's a content decision, not a code defect, and this pass does
  not invent copy to paper over it — consistent with how the rest of this
  repo already treats placeholders (author names, hero copy, the GitHub
  repo link).

## 2. Repository impact

**New files:**
- `lib/admin-guard.ts` — single source of truth for whether the CMS write
  surface is reachable.
- `lib/site.ts` — shared absolute site URL (sitemap/robots/Open Graph).
- `app/robots.ts`, `app/sitemap.ts` — Next.js metadata-route conventions;
  sitemap is generated from `getAllEditorials()`, so it can't drift from
  what's actually published.
- `app/icon.svg` — see §4.
- `docs/deployment-readiness.md` — this file.

**Modified files:**
- `middleware.ts` — added the admin-surface gate (§3).
- `next.config.mjs` — added baseline security headers.
- `app/[locale]/layout.tsx` — `generateMetadata` now sets `metadataBase`,
  Open Graph fields, and a temporary sitewide `noindex` (§5).
- `.env.example` — documented the new (optional) `NEXT_PUBLIC_SITE_URL`.

**Untouched, and why:** `velite.config.ts`, `keystatic.config.ts`'s schema,
all three viz engines, `lib/content.ts`, all page components' actual
logic, Phase 2 (`docs/phase-2-architecture.md`, `drizzle-orm`,
`better-auth`, etc. stay exactly as reserved-but-unbuilt). None of this
needed to change for deployment readiness, and the brief explicitly asks
to avoid unrelated expansion.

## 3. Risk fixed: the CMS write surface was unauthenticated by default

**Classification: HIGH.** Found, not invented — the code already flagged
it (`app/keystatic/team-photo/page.tsx`'s and
`components/site/team-photo-uploader.tsx`'s own comments say production
access control was "not this widget's concern" and deferred to a
GitHub-storage path that wasn't actually wired to enforce anything).

- **Cause:** `keystatic.config.ts` falls back to `{ kind: "local" }`
  whenever `KEYSTATIC_GITHUB_CLIENT_ID` is unset — the default, since no
  GitHub OAuth App exists yet. Local-storage Keystatic has no
  authentication of its own. Nothing previously stopped `/keystatic` from
  loading on a real deployment, and `app/api/team-photo/route.ts` is a
  public `POST` endpoint the moment `BLOB_READ_WRITE_TOKEN` is set —
  independent of Keystatic's storage mode entirely.
- **Impact:** Anyone with the URL could open a live-looking (but
  non-functional — serverless filesystems don't persist writes) admin UI,
  and, separately, anyone could upload files to your Vercel Blob store
  and consume storage/bandwidth, with zero login of any kind.
- **Mitigation shipped:** `lib/admin-guard.ts` + `middleware.ts` now gate
  `/keystatic`, `/api/keystatic/*`, and `/api/team-photo` together as one
  unit: reachable unconditionally in local dev, and in a deployed build
  (Vercel sets `NODE_ENV=production` for both preview and production
  deploys) only once `KEYSTATIC_GITHUB_CLIENT_ID` is set — at which point
  GitHub OAuth + repo permissions become the real access control for
  `/keystatic` itself.
- **What this does *not* fix:** when GitHub-storage mode is configured in
  production, `/api/team-photo` still runs its own current-session check in
  `app/api/team-photo/route.ts` and therefore remains restricted to an
  authenticated user, not just anyone with the URL. This is now explicitly
  implemented rather than left as a future recommendation.
- **Mitigation required before implementation?** No — implemented in this
  pass.

## 4. Other technical gaps closed (all LOW risk, all reversible)

- **No favicon at all.** Added `app/icon.svg` — reuses the header's
  existing dot mark and the already-decided `cherenkov-blue-pastel` color
  from `tailwind.config.ts`. This is a functional placeholder, not a new
  branding decision (no new color, shape, or typeface introduced) — swap
  it out whenever real identity work happens.
- **No `robots.txt` / `sitemap.xml`.** Added via Next's file conventions;
  sitemap is derived entirely from existing content, nothing hand-written.
- **No security response headers.** Added the standard low-risk baseline
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) in `next.config.mjs`. A real
  `Content-Security-Policy` was deliberately left out — it needs to be
  worked out against Keystatic's admin UI and the Blob image host, which
  is a bigger decision than fits in this pass (§7).
- **No `metadataBase` / Open Graph tags.** Added, using an env-driven
  `NEXT_PUBLIC_SITE_URL` that falls back to `localhost:3000` — same
  "placeholder until the real value is known" pattern as
  `KEYSTATIC_GITHUB_REPO`.

## 5. BLOCKING — needs your decision, not guessed here

These are exactly the items the README's own "Open questions" section
already names. Restated here only because they're the reason the *site*,
as opposed to the *code*, isn't ready for real visitors yet:

1. **Placeholder copy is still live-visible.** `messages/id.json` and
   `messages/en.json` have `heroTitle`, `heroBody`, `site.tagline`,
   `philosophyPlaceholder`, `teamPlaceholder`, and the footer tagline all
   as `[PLACEHOLDER — ...]` strings — and `site.tagline` is literally what
   renders as the page's meta description tag. **This pass responds by
   defaulting every page to `noindex, nofollow`** (in
   `app/[locale]/layout.tsx`) so search engines don't index the
   placeholder text — remove that `robots` line once real copy is in.
2. ~~Repo URL~~ — **resolved.** `components/site/header.tsx`, the About
   page, `keystatic.config.ts`'s fallback, and `.env.example` all now
   point at `github.com/project-cherenkov/project-cherenkov-app`.
   **New flag, surfaced by resolving this one:** the repo is *private*.
   The About page's own copy says *"Cherenkov is built in the open... see
   the commit history and contribute on GitHub"*, and the header has a
   public "GitHub" nav link — both now point a public visitor at a repo
   they can't open. Not fixed here (it's a content/copy decision, same
   rule as item 1): either make the repo public before launch, or adjust
   that copy/link so it doesn't promise open access it can't deliver.
3. **Keystatic GitHub OAuth.** Per §3, the admin surface stays gated in
   any deployed build until `KEYSTATIC_GITHUB_CLIENT_ID` /
   `KEYSTATIC_GITHUB_CLIENT_SECRET` are set, which needs a real GitHub
   OAuth App — not something to invent a value for. `KEYSTATIC_GITHUB_REPO`
   itself is now resolved (item 2). Until the OAuth App exists, editing
   content in production means editing MDX files directly and pushing,
   exactly as it works today without Keystatic.
4. **Team-photo upload, once enabled** — see §3's "does not fix" note.

None of these block *pushing the code* — the build succeeds and the
public archive works with all four unresolved. They block treating the
result as a finished public launch rather than a working preview.

## 6. Deployment steps (unchanged from the README, confirmed still accurate)

1. Push this repo to GitHub.
2. Import it in Vercel (framework auto-detected as Next.js — no
   `vercel.json` needed).
3. Deploy with **zero environment variables** for the core archive to
   work. Optionally set `NEXT_PUBLIC_SITE_URL` once you have a domain.
4. Every PR gets its own preview deploy automatically (Vercel default);
   the existing `.github/workflows/ci.yml` runs install → generate → lint
   → typecheck → build on every push/PR regardless of Vercel.
5. Before announcing it publicly: resolve §5's items, then remove the
   `robots: { index: false, follow: false }` line in
   `app/[locale]/layout.tsx`.

## 7. Recommended (not required for this pass)

- A real `Content-Security-Policy` header once Keystatic's admin UI and
  Blob's image host are both accounted for.
- No additional team-photo auth recommendation remains: the route already
  enforces `getCurrentUser()` + admin checks in `app/api/team-photo/route.ts`
  and the deployment note above is updated to reflect that implementation.
- Tightening `principle`/`errorType` from free strings to a fixed enum
  once enough real editorials exist to see the real vocabulary
  (`velite.config.ts`'s own note — unrelated to deployment, restated here
  only because it was already flagged as open).

## 8. Optional / explicitly out of scope for this pass

- Removing the unused `@radix-ui/react-dialog` / `@radix-ui/react-tabs`
  dependencies and their matching `components/ui/dialog.tsx` /
  `tabs.tsx` files (currently imported nowhere) — minor install-size
  cleanup, not a deployment blocker, and may be reserved for near-term UI
  work.
- Resolving the `vizEngine: "none"` schema-vs-spec conflict
  (`velite.config.ts`) — pre-existing, flagged, and explicitly not this
  task's call per that file's own comment.
- Any Phase 2 work (accounts, planner, Neon/Drizzle/Better Auth) — out of
  scope by the project's own phasing.

## 9. Verification

This pass was written and reviewed without running `pnpm install` (no
network access in this environment), so nothing here has been compiled or
type-checked directly. Before merging:

```bash
pnpm install
pnpm generate   # regenerates .velite/ so typecheck/lint can resolve #content
pnpm typecheck
pnpm lint
pnpm build
```

`.github/workflows/ci.yml` already runs exactly this sequence on every
push/PR, so pushing to a branch and opening a PR will verify it
independently of running it locally first.

## 10. Final assessment

- **Sufficiently specified/implemented to deploy?** Yes, for a working
  preview — push and import to Vercel today and the public archive works.
- **User clarification required before a real public launch?** Yes — §5's
  four items, none of which this pass guessed at.
- **Highest-risk part of this feature:** §3 (the CMS write surface) —
  fixed here, with one residual gap called out rather than papered over.
- **Most important acceptance criterion:** `/keystatic`,
  `/api/keystatic/*`, and `/api/team-photo` return 404 on a production
  build when `KEYSTATIC_GITHUB_CLIENT_ID` is unset, and are unaffected
  (still reachable) under `pnpm dev`.
