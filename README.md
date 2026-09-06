# **Project Cherenkov**

## **Table of Contents**

1. [Short Description](#i-short-description)
2. [Tech Stack & Hosting](#ii-tech-stack--hosting)
3. [Project Structure](#iii-project-structure)
4. [Getting Started](#iv-getting-started)
5. [Content Model — Writing an Editorial](#v-content-model--writing-an-editorial)
6. [Editing Content in the Browser (Keystatic)](#vi-editing-content-in-the-browser-keystatic)
7. [Composed Scenes & the Scene Builder](#vii-composed-scenes--the-scene-builder)
8. [Internationalization](#viii-internationalization)
9. [Deploying](#ix-deploying)
10. [FAQ](#x-faq)
11. [Current Status & Open Questions](#xi-current-status--open-questions)

---

## **I. Short Description**

Project Cherenkov is an Indonesian OSN (olympiad) editorial archive and study planner spanning **informatics, physics, and astronomy**. Each editorial is a rigorous, self-contained write-up of one idea — a proof, a derivation, a technique — and every editorial ships paired with a **working interactive visualization**, not a decorative one: the visualization is how the idea is explored, not an illustration bolted on afterward.

## **Legal & Contact**

- License: [LICENSE](LICENSE)
- Terms: [TERMS.md](TERMS.md)
- Privacy: [PRIVACY.md](PRIVACY.md)
- Project contact: projectcherenkov@gmail.com

These documents are intentionally kept in dedicated files instead of burying them inside the README. The public website should also link to the relevant pages in its footer or About section for users to find them easily.

The archive is indexed by **principle** (the general idea an editorial teaches) and **error type** (the specific mistake it corrects), deliberately **not** by subject chapter — the goal is to let someone arrive because they made a specific mistake or want to understand a specific idea, not because they're browsing a syllabus.

This repo contains **Phase 1** (the public archive) and the implemented **Phase 2** account and study-planner layer. Visitors can browse, read, and interact with the archive without an account; signed-in users can generate a study plan, track progress through quiz attempts, and open topic pages. Phase 3 adaptive scheduling remains planned but is not implemented — see `docs/phase-3-architecture.md`.

Content is git-committed MDX, not stored in a database: there is no CRUD backend for editorials, only files under `content/editorials/`, compiled at build time. Editing happens either by editing those files directly, or through an in-site CMS layer ([Section VI](#vi-editing-content-in-the-browser-keystatic)) that writes back to the same files.

---

## **II. Tech Stack & Hosting**

| Layer | Choice | Why |
| --- | --- | --- |
| **Framework** | [Next.js](https://nextjs.org/) 15 (App Router) + TypeScript | Server-rendered pages for content that should be crawlable and fast on a first load, with the App Router's per-route code splitting keeping each editorial's (potentially heavy) visualization out of every other page's bundle. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + hand-rolled shadcn/ui-style primitives (`components/ui/`) | Utility-first styling with design tokens (`tailwind.config.ts`) as the single source of truth for color/spacing, rather than scattering hex values through components. |
| **Content pipeline** | MDX compiled with [Velite](https://velite.js.org) | Gives every editorial a typed, Zod-validated frontmatter schema (`velite.config.ts`) checked at build time. Visualization-specific `vizConfig` shapes are additionally checked by runtime type guards because their frontmatter field is intentionally generic. `lib/content.ts` is the only place that touches Velite's generated `#content` output directly; every page goes through it. |
| **Math typesetting** | [KaTeX](https://katex.org/) via `remark-math`/`rehype-katex` | Compiled to static HTML **at build time**, so a reader's browser never runs math-rendering JS or reflows the page after load. |
| **Visualizations** | [D3](https://d3js.org/) (scales only) + Canvas 2D / `requestAnimationFrame` | Four engines (`components/viz/`), dispatched by `vizEngine` in an editorial's frontmatter (see [Section V](#v-content-model--writing-an-editorial)): three purpose-built (a graph/array stepper, a trajectory sandbox, an orbital sandbox) plus `composed-scene`, a generic, template-driven engine with its own in-browser authoring tool — see [Section VII](#vii-composed-scenes--the-scene-builder). D3 is used narrowly for its scale math, not as a full charting layer, since each engine's rendering is bespoke. |
| **i18n** | [next-intl](https://next-intl.dev/) | Locale-prefixed routing (`id`/`en`) via `middleware.ts` and `i18n/routing.ts` — see [Section VIII](#viii-internationalization). |
| **CMS** | [Keystatic](https://keystatic.com/) | In-site editing at `/keystatic`, mirroring `velite.config.ts`'s schema field-for-field (`keystatic.config.ts`). Local-storage mode in development, GitHub-storage mode (real OAuth-backed auth) in production — see [Section VI](#vi-editing-content-in-the-browser-keystatic). |
| **Image uploads** | [Vercel Blob](https://vercel.com/storage/blob) | Backs the team-photo upload path (`app/api/team-photo/route.ts`, used from `/keystatic/team-photo`). Gated by the same production rule as Keystatic itself — see [Section VI](#vi-editing-content-in-the-browser-keystatic). |
| **Package manager** | [pnpm](https://pnpm.io) | — |

**Hosting:** [Vercel](https://vercel.com). The live deployment is available at [project-cherenkov-app.vercel.app/en](https://project-cherenkov-app.vercel.app/en). The repo is public at [github.com/project-cherenkov/project-cherenkov-app](https://github.com/project-cherenkov/project-cherenkov-app). Framework detection is automatic for Next.js — no `vercel.json` is needed. See [Section IX](#ix-deploying) for deployment details.

| Layer | Choice | Why |
| --- | --- | --- |
| **Database** | [Neon](https://neon.tech/) serverless Postgres | Stores accounts, study plans, topics, quiz questions, and quiz attempts. |
| **ORM and migrations** | [Drizzle ORM](https://orm.drizzle.team/) | Defines the database schema in TypeScript and manages migrations. |
| **Authentication** | [Better Auth](https://www.better-auth.com/) | Provides email/password authentication; Google OAuth is optional when both Google credentials are configured. |
| **Planner and quizzes** | `lib/planner*.ts` and `lib/quiz*.ts` | Implements plan generation, progress tracking, quiz scoring, and server actions. |

Phase 3 adaptive scheduling remains a design document in `docs/phase-3-architecture.md`.

---

## **III. Project Structure**

```text
app/[locale]/                    routes (everything is locale-prefixed)
  archive/                       archive listing, filterable by subject/principle/errorType
  archive/[subject]/[slug]/      one editorial's page
  about/                         team + repo link
  login/ signup/                 Better Auth email/password forms
  planner/                       authenticated plan overview and generation
  planner/[subject]/[chapter]/   topic status, linked editorial, and quiz (chapter segment contains topic ID)
  error.tsx, not-found.tsx       locale-scoped error and 404 pages
app/keystatic/                   Keystatic admin UI (gated in production — Section VI)
app/keystatic/scene-builder/     the composed-scene authoring tool's page (Section VII)
app/api/keystatic/               Keystatic's own API route (gated in production)
app/api/team-photo/              Vercel Blob upload endpoint (gated in production)
app/api/scene-builder/           composed-scene write-back route + its own GitHub OAuth
                                  flow (gated in production — Section VII)
app/robots.ts, app/sitemap.ts    generated from the same content query every page uses
app/icon.svg                     favicon
components/
  ui/                            hand-rolled shadcn/ui-style primitives
  site/                          header, footer, cards, filters, team-photo uploader
  site/scene-builder/            the scene builder's palette/inspector/timeline UI (Section VII)
  viz/                           the four visualization engines + shared playback controls
  viz/composed-scene/            the composed-scene engine: element templates + renderer
content/editorials/<subject>/    the actual archive content (MDX)
content/team/                    Keystatic-managed team singleton (About page)
lib/content.ts                   all querying/filtering of editorials goes through here —
                                  pages never import Velite's #content directly
lib/team.ts                      reads the Keystatic team singleton for the About page
lib/admin-guard.ts               single source of truth for whether /keystatic, the
                                  team-photo route, and the scene-builder routes are
                                  reachable (Section VI)
lib/site.ts                      shared absolute site URL for sitemap/robots/Open Graph
lib/auth.ts, lib/auth-guard.ts   Better Auth configuration and session checks
lib/planner*.ts, lib/quiz*.ts    plan generation, progress, scoring, and actions
lib/scene-builder-*.ts           composed-scene frontmatter write-back, its dedicated
                                  GitHub OAuth flow, and its GitHub API client (Section VII)
lib/db/                          Drizzle schema and lazy Neon database client
messages/{id,en}.json            UI strings
drizzle/                         generated migration output (created by Drizzle Kit)
scripts/                          topic and example quiz-question seed scripts
docs/phase-2-architecture.md     implemented Phase 2 decisions and data model
docs/phase-3-architecture.md     Phase 3 adaptive-scheduling plan (not implemented)
docs/deployment-readiness.md     what's been hardened for production, what still needs
                                  a real decision (Section IX) — written before the
                                  scene builder existed, so treat it as historical
                                  context rather than the current file/dependency list
```

---

## **IV. Getting Started**

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/project-cherenkov/project-cherenkov-app.git
cd project-cherenkov-app
pnpm install
pnpm dev
```

### Stopping the app properly

`pnpm dev` starts both the Next.js server and the Velite content watcher. If you close the terminal with Ctrl+C repeatedly, a stale Node process can sometimes remain listening on a port, which is why you may later see warnings like `Port 3000 is in use, using available port 3001 instead`.

If that happens, stop the old process before relaunching the app:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002 -ErrorAction SilentlyContinue | Format-Table -AutoSize
```

Then terminate the owning process ID:

```powershell
Stop-Process -Id <PID> -Force
```

After that, start the app again:

```bash
pnpm dev
```

If you want to force a specific port, run:

```bash
npx next dev -p 3000
```

or any other port you prefer. If the port is still busy, the app will continue to choose the next free one unless you first stop the process holding that port.

| Script | Does |
| --- | --- |
| `pnpm dev` | Runs `next dev` and `velite dev` together (via `concurrently`) — Velite watches `content/` and regenerates its output automatically, nothing to run separately. |
| `pnpm build` | `velite build && next build` — a full production build. |
| `pnpm generate` | `velite build` on its own. Run this once after a fresh clone if your editor complains that `#content` can't be found, or if a typecheck fails before you've ever run `pnpm dev`. |
| `pnpm lint` | Runs the configured Next.js lint command. |
| `pnpm typecheck` | `tsc --noEmit`. Also depends on `.velite/` existing — run `pnpm generate` first if this is the very first command you run after cloning. |
| `pnpm test` | Runs the Vitest test suite once. |
| `pnpm test:watch` | Runs Vitest in watch mode. |
| `pnpm db:generate` | Generates Drizzle migrations from `lib/db/schema.ts`; does not require a database connection. |
| `pnpm db:migrate` | Applies Drizzle migrations; requires `DATABASE_URL`. |
| `pnpm db:seed` | Generates Velite output, then seeds topics and one example quiz question per editorial; requires `DATABASE_URL`. |
| `pnpm start` | Serves an already-built app (`next start`). |

### Environment variables

**The public archive needs none of the account variables below.** Accounts, planner pages, quizzes, and auth API routes require a configured database and Better Auth secret. The database and auth clients are lazy, so the archive can still build and run with zero database configuration. Full detail and current defaults live in `.env.example`; the short version below is the deployment-oriented summary.

| Variable | Required? | Purpose | How to get it (summary) |
| --- | --- | --- | --- |
| `KEYSTATIC_GITHUB_CLIENT_ID` / `KEYSTATIC_GITHUB_CLIENT_SECRET` | Optional | Switches Keystatic from local-storage mode to GitHub-storage mode. Without it, `/keystatic` edits your local working copy directly — nothing to configure. **Also controls whether `/keystatic` is reachable at all once deployed** — see [Section VI](#vi-editing-content-in-the-browser-keystatic). The scene builder ([Section VII](#vii-composed-scenes--the-scene-builder)) reuses the same two vars to drive its own, separate GitHub OAuth flow — no additional vars needed for that. | Create a GitHub OAuth App under GitHub → Settings → Developer settings → OAuth Apps; set the homepage to your deployed URL and the callback to `https://<your-domain>/api/keystatic/github/oauth/callback`. |
| `KEYSTATIC_SECRET` | Optional | Required alongside the two above for GitHub-storage mode. Also signs the scene builder's own short-lived GitHub-token cookie (Section VII). | Run `openssl rand -base64 32` and paste the result. |
| `KEYSTATIC_GITHUB_REPO` | Optional | Which repo Keystatic commits to in GitHub-storage mode. Defaults to `project-cherenkov/project-cherenkov-app` if unset — only needed if you're running a fork under a different name. | Usually leave unset; set only if you are using a fork or different repo name. |
| `ADMIN_EMAILS` | Required for team-photo uploads | Comma-separated email allow-list for content editors. The upload route requires both an authenticated session and a matching email. | Add a comma-separated list such as `editor@example.com, second-editor@example.com` in Vercel's environment variables. |
| `BLOB_READ_WRITE_TOKEN` | Required for team-photo uploads | Powers the team-photo upload path after authorization succeeds. Without it, that route returns a clear error instead of failing inside Vercel Blob's own API. | Create a Vercel Blob store in the project, link it to the project, and let Vercel create the env var automatically. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Absolute origin used by `app/sitemap.ts`, `app/robots.ts`, and Open Graph metadata. Falls back to `http://localhost:3000` if unset — set it to `https://project-cherenkov-app.vercel.app` in Vercel, or replace it with the eventual custom domain. | Use the deployed origin, e.g. `https://project-cherenkov-app.vercel.app` or your custom domain in Vercel. |
| `DATABASE_URL` | Required for accounts/planner | Neon/Postgres connection string used by Drizzle and Better Auth. Not needed for the public archive or CI's unit tests. | Create a Neon project and copy the connection string from Neon → Connection Details. |
| `BETTER_AUTH_SECRET` | Required for accounts/planner | Secret used by Better Auth for sessions. | Run `openssl rand -base64 32` and paste the result. |
| `BETTER_AUTH_URL` | Recommended for accounts/planner | Canonical application URL used by Better Auth; use the deployed origin in production. | Set to your deployed origin, usually `https://project-cherenkov-app.vercel.app`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Enables the "Continue with Google" buttons and Google OAuth. Email/password remains available without these. | Create a Google OAuth web client in Google Cloud Console and add the callback URL `https://<your-domain>/api/auth/callback/google`. |

The account variables are not needed to browse the archive. Without `DATABASE_URL`, requests to authenticated Phase 2 features fail closed as unauthenticated rather than making the public archive unavailable.

---

## **V. Content Model — Writing an Editorial**

Add a `.mdx` file under `content/editorials/<subject>/`. Frontmatter is validated by `velite.config.ts` at build time:

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string, ≤120 chars | — |
| `subject` | `"informatics"` \| `"physics"` \| `"astronomy"` | Must match the folder it's in — the three Keystatic collections enforce this structurally (see [Section VI](#vi-editing-content-in-the-browser-keystatic)). |
| `hook` | string, ≤280 chars | One sentence that makes someone want to read on. |
| `tags` | string[] | Short, lowercase. |
| `principle` | string | The general idea this editorial teaches. **Free text on purpose** — see [Section XI](#xi-current-status--open-questions). |
| `errorType` | string, optional | The specific mistake this editorial corrects. Also free text. |
| `vizEngine` | `"graph-array-stepper"` \| `"trajectory-sandbox"` \| `"orbital-sandbox"` \| `"composed-scene"` \| `"none"` | Which engine to render. The first three are hand-written per visualization type; `composed-scene` is authored visually rather than by hand — see [Section VII](#vii-composed-scenes--the-scene-builder). `"none"` is a legal schema value but a flagged content error in the UI — see FAQ C. |
| `vizConfig` | object, shape depends on `vizEngine` | See the engine-by-engine notes below. |
| `publishedAt` | ISO date | — |
| `author` | string | — |
| body | MDX | Everything after the frontmatter. |
| `slug` | *(derived, not frontmatter)* | Taken from the filename, not the title — retitling a published piece never silently changes its URL. |

Body is regular Markdown/MDX. Use `$...$` for inline math and `$$...$$` for display math — it's compiled to static KaTeX HTML at build time (see [Section II](#ii-tech-stack--hosting)), so there's no math-rendering JS shipped to the reader.

Place `<Interactive />` on its own line wherever the visualization should sit — typically between "the idea" and "the full proof." **If you forget it, the visualization still renders** (right after the hook, with a small notice) rather than silently publishing an editorial with no interactive — see FAQ B for exactly why it's built this way. Placing the tag yourself just gives you control over where it lands, which reads better.

Three real, complete examples to copy from:

- `content/editorials/informatics/binary-search-on-answer.mdx` (`graph-array-stepper`)
- `content/editorials/physics/projectile-range-symmetry.mdx` (`trajectory-sandbox`)
- `content/editorials/astronomy/eccentric-transit-duration.mdx` (`orbital-sandbox`)

### `vizConfig` by engine

**`graph-array-stepper`** — an array with precomputed steps (pointers, highlighted cells, a one-line note per step). Frontmatter is static data, not code, so there's no literal "step function": you write out each step's state directly.

```yaml
vizConfig:
  array: [2, 4, 6, 8, 10]
  steps:
    - pointers: { lo: 0, hi: 4, mid: 2 }
      highlight: [2]
      note: "What's happening at this step."
```

**`trajectory-sandbox`** — adjustable initial speed/angle, animated on a canvas. `physicsType` selects a named physics function from a small registry in `components/viz/trajectory-sandbox/index.tsx` (same reason as above: frontmatter can't hold a real function). Currently only `"projectile"` exists; adding a new scenario means adding one entry to that registry.

```yaml
vizConfig:
  physicsType: projectile
  gravity: 9.8
  initial: { speed: 20, angleDeg: 45 }
  speedRange: [5, 40] # optional slider bounds
  angleRange: [5, 85]
```

**`orbital-sandbox`** — eccentricity + mass ratio sliders driving a Kepler-accurate orbit and a simplified, clearly-labeled-as-schematic transit light curve (periapsis-aligned transit; see the astronomy example for the derivation and its stated limits).

```yaml
vizConfig:
  eccentricity: 0.3
  semiMajorAxisPx: 130
  periodSeconds: 6
  massRatio: 0.05 # optional, default 0.05
  transitDepth: 0.015 # optional, default 0.01
```

**`composed-scene`** — the fourth, general-purpose engine: a scene made of reusable element templates (shapes, curves, text, a slider-bound marker, an array-with-pointers widget) instead of one bespoke renderer per visualization type. Its `vizConfig` is a structured object (canvas size, elements, optional controls, optional steps) that's impractical to hand-write in frontmatter — it's authored visually instead, at `/keystatic/scene-builder`. See [Section VII](#vii-composed-scenes--the-scene-builder) for the full shape and the authoring workflow.

---

## **VI. Editing Content in the Browser (Keystatic)**

`/keystatic` mirrors `velite.config.ts`'s schema field-for-field: three collections (one per subject, each hardcoded to its own `content/editorials/<subject>/*` path, so a folder/frontmatter subject mismatch is structurally impossible) plus a `team` singleton backing the About page's team list.

**Two storage modes**, chosen automatically by whether `KEYSTATIC_GITHUB_CLIENT_ID` is set (`keystatic.config.ts`):

- **Local** (default, no env vars): edits write straight to your working copy on disk. This is the right mode for local development, and the only mode local development needs.
- **GitHub** (`KEYSTATIC_GITHUB_CLIENT_ID`/`_SECRET`/`KEYSTATIC_GITHUB_REPO` set): edits go through a real GitHub OAuth flow and land as commits against the repo, gated by the logged-in user's actual GitHub repo permissions.

**On a deployed build, `/keystatic`, `/api/keystatic/*`, `/api/team-photo`, and `/api/scene-builder/*` are only reachable in GitHub-storage mode** — `lib/admin-guard.ts` returns a 404 for all of them otherwise, enforced at the edge in `middleware.ts` (`/keystatic/scene-builder`, the scene builder's own page, needs no separate entry there — it already falls under the `/keystatic` prefix). See FAQ A for why: local-storage mode has no authentication of its own, and a deployed server's filesystem doesn't persist writes between requests anyway, so leaving it reachable in production would serve a live-looking but non-functional CMS to any visitor — and separately, would leave the team-photo upload endpoint open to the entire internet the moment `BLOB_READ_WRITE_TOKEN` exists.

Until a GitHub OAuth App is set up for real, editing content in production means editing MDX files directly and pushing — exactly how it already works without Keystatic at all.

---

## **VII. Composed Scenes & the Scene Builder**

The three engines in [Section V](#v-content-model--writing-an-editorial) are each hand-written for one kind of visualization. `composed-scene` is a fourth, general-purpose engine for whatever those three don't already cover: instead of bespoke render code, an author assembles a scene from a fixed library of reusable **element templates**, and the engine (`components/viz/composed-scene/`) interprets that data at render time on a Canvas 2D surface — the same code-splitting and dynamic-import treatment as the other three engines in `components/viz/viz-engine.tsx`.

None of the three example editorials use it yet — it's a newer complement to the fixed engines, not a replacement for them.

### The `vizConfig` shape

```yaml
vizConfig:
  canvas: { widthPx: 400, heightPx: 240 }
  elements:
    - id: sun
      templateId: shape-circle
      label: "Sun"
      params: { x: 60, y: 60, radius: 20, color: blue }
  controls:                    # optional
    - id: radius-slider
      kind: slider
      label: "Radius"
      bindsTo: { elementId: sun, paramKey: radius }
      min: 5
      max: 60
  steps:                       # optional — omitted entirely means a static scene
    - note: "What's happening at this step (Markdown + KaTeX)."
      overrides:
        sun: { radius: 30 }   # only the params that change this step
```

- **`canvas`** — a fixed design-space width/height in pixels that every element's coordinates are authored against; `ComposedScene` derives one uniform scale factor from the actual rendered container width (the same approach `trajectory-sandbox` already uses for its own `toPx()`), so a scene composed at one size still renders correctly at another.
- **`elements`** (required, 1–12 — `MAX_ELEMENTS` in `components/viz/composed-scene/types.ts`) — each has a stable `id`, a `templateId` naming one of the eleven registered templates below, an optional author-facing `label`, and a `params` object matching that template's own declared parameter schema.
- **`controls`** (optional) — sliders or toggles bound to one element's one param via `bindsTo: { elementId, paramKey }`; a slider can only bind to a numeric param, a toggle only to a boolean one.
- **`steps`** (optional, 0–20 — `MAX_STEPS`) — the same authoring shape as `graph-array-stepper`'s `steps`, generalized: each step is an optional Markdown/KaTeX `note` plus sparse per-element `overrides` (only the params that change need to be listed; anything omitted keeps that element's base `params` value).

### The eleven element templates

Registered in `components/viz/composed-scene/element-templates.ts` (`ELEMENT_TEMPLATES`) — adding a new one means adding one entry there, never a schema change:

| Template ID | What it draws |
| --- | --- |
| `shape-circle` | A filled circle (position, radius, color). |
| `shape-rect` | A filled rectangle (position, width, height, color). |
| `shape-line` | A straight line between two points. |
| `shape-arrow` | A line with an arrowhead at its second point. |
| `text-label` | Literal display text — never evaluated as an expression or formula. |
| `curve-linear` / `curve-quadratic` / `curve-sine` | Named curve shapes between/around control points. |
| `curve-points` | A polyline through 2–4 author-placed points. |
| `slider-marker` | A small marker styled specifically as "the thing a slider moves" (distinct from `shape-circle` mainly so the builder's palette carries an obvious "bind a slider to this" card). |
| `array-pointers` | An array-with-pointers widget (up to 8 cells, up to 3 named pointers, one highlighted index) — a bounded, Canvas-rendered adaptation of `graph-array-stepper`'s own array visual, for composing it alongside other elements in one scene. |

Every param on every template is a number, a bounded select, a boolean, or short plain text — deliberately never a freeform formula/expression field, so a scene can never encode arbitrary logic.

### Validation

`isComposedSceneConfig` (`components/viz/composed-scene/types.ts`) is the single guard used everywhere a `composed-scene` config is trusted: by `viz-engine.tsx` before rendering a published editorial, by `lib/scene-builder-write.ts` before writing anything back to a file, and by the scene builder UI itself before enabling its "Save" button — so what counts as valid is defined once, not reimplemented per call site. It checks the same things the other three engines' guards check: every `templateId` must be registered, every param present must match its template's declared type and bounds, and every `elementId` a control or step references must actually exist.

### The authoring tool: `/keystatic/scene-builder`

A three-pane UI (`components/site/scene-builder/`) for composing a scene without hand-writing YAML:

- **Palette** — add an element from any of the eleven templates (disabled once the 12-element cap is hit).
- **Canvas preview + timeline** — a live `ComposedScene` render of the current draft, plus a step-by-step timeline editor for adding/reordering/removing steps.
- **Inspector** — edit the selected element's label and params, bind/unbind sliders and toggles, and edit the current step's per-element overrides.

Reached from a specific editorial's `vizConfig` field description inside `/keystatic` itself (pre-filled with that editorial's `?subject=&slug=`), or directly, with its own subject/slug fields as a fallback for retargeting a draft in progress.

**Saving** posts the composed draft to `POST /api/scene-builder`, which requires both an authenticated session and an email in `ADMIN_EMAILS` (the same authorization `/api/team-photo` uses), then rewrites only the target editorial's `vizEngine` and `vizConfig` frontmatter keys — the MDX body and every other frontmatter key are left untouched (verified byte-for-byte against the three real example editorials in `scene-builder-write.test.ts`'s round-trip suite). Which storage path it writes to is chosen by the same signal Keystatic itself uses:

- **Local** (default, no env vars): writes the change straight to the target file on disk.
- **GitHub** (`KEYSTATIC_GITHUB_CLIENT_ID` set): commits the change to a brand-new branch (`keystatic/scene-builder-<slug>-<timestamp>`) off the repository's default branch. **This does not open or merge a pull request automatically** — the author still opens a PR on GitHub to actually publish the change.

GitHub mode needs its own authorization step first, via a **dedicated GitHub OAuth flow** (`app/api/scene-builder/github-oauth/{start,callback}/route.ts`, `lib/scene-builder-oauth.ts`) — deliberately separate from both Keystatic's own admin-UI session and Better Auth's session, so that a temporary, deployment-mode-specific OAuth token never needs a schema migration onto the durable user/session tables. It reuses the already-configured `KEYSTATIC_GITHUB_CLIENT_ID`/`KEYSTATIC_GITHUB_CLIENT_SECRET`/`KEYSTATIC_SECRET` env vars rather than provisioning new ones, and keeps the resulting GitHub access token in its own short-lived (1 hour), HMAC-signed, `httpOnly` cookie.

**Access is gated the same way as the rest of the CMS write surface**: `/keystatic/scene-builder`, `/api/scene-builder/*`, and the OAuth routes all fall under `middleware.ts`'s admin-surface gate (Section VI), so on a deployed build they 404 together with `/keystatic` unless `KEYSTATIC_GITHUB_CLIENT_ID` is set — and `/api/scene-builder`'s own handler separately re-checks the caller's session and `ADMIN_EMAILS` membership per request, the same defense-in-depth pattern `/api/team-photo` uses.

---

## **VIII. Internationalization**

Locales live in `messages/id.json` and `messages/en.json`, same keys in both, loaded via `i18n/request.ts`. Every route is locale-prefixed (`middleware.ts` + `i18n/routing.ts`) — `id` is the default locale but still gets its own `/id` prefix rather than living at the bare root.

To add a locale: add it to `i18n/routing.ts`'s `locales` array and add a matching `messages/<locale>.json`.

---

## **IX. Deploying**

The public archive is deployed on Vercel at [project-cherenkov-app.vercel.app/en](https://project-cherenkov-app.vercel.app/en). It can be deployed with **zero required environment variables** for the archive-only experience.

1. **Push to GitHub.** This repo lives at [`github.com/project-cherenkov/project-cherenkov-app`](https://github.com/project-cherenkov/project-cherenkov-app) and is public.
2. **Import the repo in [Vercel](https://vercel.com/new).** Next.js is auto-detected; no `vercel.json` or custom build command is needed.
3. **Deploy.** No environment variables are required for the archive, i18n, or MDX pipeline.
4. **Set `NEXT_PUBLIC_SITE_URL`** to `https://project-cherenkov-app.vercel.app` (or the eventual custom domain) in Vercel so the sitemap and Open Graph metadata use the deployed origin instead of `localhost`.
5. **Every PR gets its own preview deploy** automatically (Vercel's default behavior for a connected repo) — nothing extra to configure.
6. **CI runs independently of Vercel.** `.github/workflows/ci.yml` runs install → `pnpm generate` → lint → typecheck → test → build on every push/PR, so a broken build or failing test is visible on GitHub as well as through Vercel's deployment checks.

**Before a fully polished public launch**, read `docs/deployment-readiness.md` and resolve:

- The team bios and contact details in `messages/*.json` still need to be written — until they are, every page ships with `robots: { index: false, follow: false }` on purpose (`app/[locale]/layout.tsx`). The hero, tagline, and about/philosophy copy are already finished.
- Whether/when to set up a real GitHub OAuth App so `/keystatic` (and `/keystatic/scene-builder`, Section VII) becomes reachable in production (Section VI).

The public repo and public deployment are both live; the remaining blockers are content polish and the production CMS gate, not whether the app is already deployed.

---

## **X. FAQ**

### **A. "Why does `/keystatic` 404 on Vercel until I set up GitHub OAuth?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

Local-storage Keystatic — the default, with no env vars set — has no authentication of its own; it's built to be run by whoever is already running `pnpm dev` on their own machine. Nothing stopped it from being reachable on a real deployment too, which is a problem for two separate reasons: a serverless deployment's filesystem doesn't persist writes between requests, so `/keystatic` would present a live-looking but non-functional editing UI to anyone who found the URL; and independently, the team-photo route needs its own session and `ADMIN_EMAILS` authorization regardless of Keystatic's storage mode.

`lib/admin-guard.ts` closes the deployment exposure at the edge: on a deployed build (`NODE_ENV === "production"`, which Vercel sets for both preview and production deploys), `/keystatic`, `/api/keystatic/*`, `/api/team-photo`, and `/api/scene-builder/*` (Section VII) all 404 unless `KEYSTATIC_GITHUB_CLIENT_ID` is set. The team-photo and scene-builder handlers then separately require an authenticated user whose email appears in `ADMIN_EMAILS`. Local `pnpm dev` is unaffected by the production surface gate.

</details>

### **B. "I forgot to add `<Interactive />` to my editorial — what happens?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

The visualization still renders — right after the hook, with a small notice — rather than the editorial silently publishing with no interactive at all. Every published editorial is supposed to ship a working visualization (see FAQ C for the one exception), so the fallback errs toward "show it somewhere" over "fail silently." Placing `<Interactive />` yourself just controls *where* it lands, which reads better than the automatic placement.

</details>

### **C. "Why can `vizEngine` still be `"none"` if every editorial is supposed to have a visualization?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

This is a flagged, unresolved conflict between two parts of the original build spec, not an oversight: one line states every published editorial *must* ship a working interactive visualization; the frontmatter schema section of the same spec lists `"none"` as a legal `vizEngine` value. `velite.config.ts` keeps `"none"` as valid at the schema level — so nothing here silently forecloses the option — but `lib/content.ts`'s `hasMissingViz()` treats it as a flagged content error the UI surfaces, not a legitimate published state. Which rule should actually win is still an open question; see [Section XI](#xi-current-status--open-questions).

</details>

### **D. "Why are `principle` and `errorType` free text instead of a fixed list?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

The taxonomy isn't finalized yet, and there isn't enough real content to know what the actual vocabulary should be — tightening these to a `z.enum([...])` in `velite.config.ts` before that's known would mean guessing at categories rather than deriving them from what actually gets written. Once there are enough real editorials to see the real vocabulary, `velite.config.ts` is the only file that needs to change.

</details>

### **E. "Is there still a repo mismatch, and is the site ready to be indexed?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

The repository is public and the live site is deployed at `https://project-cherenkov-app.vercel.app/en`, so the repo-visibility mismatch described in older docs is no longer current. The site still intentionally keeps `robots: { index: false, follow: false }` on deployed pages (`app/[locale]/layout.tsx`): the hero, tagline, and about/philosophy copy in `messages/*.json` are finished, but the team bios and contact details there are not yet written, so the site is public but not yet ready for a final, indexed launch.

</details>

## **XI. Current Status & Open Questions**

- The repo is public at [`github.com/project-cherenkov/project-cherenkov-app`](https://github.com/project-cherenkov/project-cherenkov-app).
- The live deployment is at [`project-cherenkov-app.vercel.app/en`](https://project-cherenkov-app.vercel.app/en).
- The language-prefixed route is active, so the default locale is served under `/en` rather than at the bare site root.
- The team bios and contact details in `messages/*.json` still need to be written, and the locale layout keeps the site `noindex`/`nofollow` until those are finalized.
- Keystatic and the scene builder (Section VII) both stay gated behind GitHub OAuth in deployed builds, and remain unavailable unless `KEYSTATIC_GITHUB_CLIENT_ID` is configured.
- The `vizEngine: "none"` schema-vs-spec conflict (FAQ C) and the free-text `principle`/`errorType` taxonomy (FAQ D) are both still open.

This is the current state of the repo: public codebase, public deployment, a couple of about-page fields still being written, and production admin access still behind the GitHub OAuth gate.