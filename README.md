# **Project Cherenkov**

## **Table of Contents**

1. [Short Description](#i-short-description)
2. [Tech Stack & Hosting](#ii-tech-stack--hosting)
3. [Project Structure](#iii-project-structure)
4. [Getting Started](#iv-getting-started)
5. [Content Model — Writing an Editorial](#v-content-model--writing-an-editorial)
6. [Editing Content in the Browser (Keystatic)](#vi-editing-content-in-the-browser-keystatic)
7. [Internationalization](#vii-internationalization)
8. [Deploying](#viii-deploying)
9. [FAQ](#ix-faq)
10. [Open Questions & Known Placeholders](#x-open-questions--known-placeholders)

---

## **I. Short Description**

Project Cherenkov is an Indonesian OSN (olympiad) editorial archive and study planner spanning **informatics, physics, and astronomy**. Each editorial is a rigorous, self-contained write-up of one idea — a proof, a derivation, a technique — and every editorial ships paired with a **working interactive visualization**, not a decorative one: the visualization is how the idea is explored, not an illustration bolted on afterward.

The archive is indexed by **principle** (the general idea an editorial teaches) and **error type** (the specific mistake it corrects), deliberately **not** by subject chapter — the goal is to let someone arrive because they made a specific mistake or want to understand a specific idea, not because they're browsing a syllabus.

This repo contains **Phase 1** (the public archive) and the implemented **Phase 2** account and study-planner layer. Visitors can browse, read, and interact with the archive without an account; signed-in users can generate a study plan, track progress through quiz attempts, and open topic pages. Phase 3 adaptive scheduling remains planned but is not implemented — see `docs/phase-3-architecture.md`.

Content is git-committed MDX, not stored in a database: there is no CRUD backend for editorials, only files under `content/editorials/`, compiled at build time. Editing happens either by editing those files directly, or through an in-site CMS layer ([Section VI](#vi-editing-content-in-the-browser-keystatic)) that writes back to the same files.

---

## **II. Tech Stack & Hosting**

| Layer | Choice | Why |
| --- | --- | --- |
| **Framework** | [Next.js](https://nextjs.org/) 15 (App Router) + TypeScript | Server-rendered pages for content that should be crawlable and fast on a first load, with the App Router's per-route code splitting keeping each editorial's (potentially heavy) visualization out of every other page's bundle. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + hand-rolled shadcn/ui-style primitives (`components/ui/`) | Utility-first styling with design tokens (`tailwind.config.ts`) as the single source of truth for color/spacing, rather than scattering hex values through components. |
| **Content pipeline** | MDX compiled with [Velite](https://velite.js.org) | Gives every editorial a typed, Zod-validated frontmatter schema (`velite.config.ts`) checked at build time — a malformed editorial fails the build instead of shipping broken. `lib/content.ts` is the only place that touches Velite's generated `#content` output directly; every page goes through it. |
| **Math typesetting** | [KaTeX](https://katex.org/) via `remark-math`/`rehype-katex` | Compiled to static HTML **at build time**, so a reader's browser never runs math-rendering JS or reflows the page after load. |
| **Visualizations** | [D3](https://d3js.org/) (scales only) + Canvas 2D / `requestAnimationFrame` | Three purpose-built engines (`components/viz/`) — a graph/array stepper, a trajectory sandbox, and an orbital sandbox — dispatched by `vizEngine` in an editorial's frontmatter (see [Section V](#v-content-model--writing-an-editorial)). D3 is used narrowly for its scale math, not as a full charting layer, since each engine's rendering is bespoke. |
| **i18n** | [next-intl](https://next-intl.dev/) | Locale-prefixed routing (`id`/`en`) via `middleware.ts` and `i18n/routing.ts` — see [Section VII](#vii-internationalization). |
| **CMS** | [Keystatic](https://keystatic.com/) | In-site editing at `/keystatic`, mirroring `velite.config.ts`'s schema field-for-field (`keystatic.config.ts`). Local-storage mode in development, GitHub-storage mode (real OAuth-backed auth) in production — see [Section VI](#vi-editing-content-in-the-browser-keystatic). |
| **Image uploads** | [Vercel Blob](https://vercel.com/storage/blob) | Backs the team-photo upload path (`app/api/team-photo/route.ts`, used from `/keystatic/team-photo`). Gated by the same production rule as Keystatic itself — see [Section VI](#vi-editing-content-in-the-browser-keystatic). |
| **Package manager** | [pnpm](https://pnpm.io) | — |

**Hosting:** [Vercel](https://vercel.com). The current deployment is available at [project-cherenkov-app.vercel.app](https://project-cherenkov-app.vercel.app/). Framework detection is automatic for Next.js — no `vercel.json` is needed. See [Section VIII](#viii-deploying) for deployment details.

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
app/keystatic/                   Keystatic admin UI (gated in production — Section VI)
app/api/keystatic/               Keystatic's own API route (gated in production)
app/api/team-photo/              Vercel Blob upload endpoint (gated in production)
app/robots.ts, app/sitemap.ts    generated from the same content query every page uses
app/icon.svg                     favicon
components/
  ui/                            hand-rolled shadcn/ui-style primitives
  site/                          header, footer, cards, filters, team-photo uploader
  viz/                           the three visualization engines + shared playback controls
content/editorials/<subject>/    the actual archive content (MDX)
content/team/                    Keystatic-managed team singleton (About page)
lib/content.ts                   all querying/filtering of editorials goes through here —
                                  pages never import Velite's #content directly
lib/team.ts                      reads the Keystatic team singleton for the About page
lib/admin-guard.ts               single source of truth for whether /keystatic and the
                                  team-photo routes are reachable (Section VI)
lib/site.ts                      shared absolute site URL for sitemap/robots/Open Graph
lib/auth.ts, lib/auth-guard.ts   Better Auth configuration and session checks
lib/planner*.ts, lib/quiz*.ts    plan generation, progress, scoring, and actions
lib/db/                          Drizzle schema and lazy Neon database client
messages/{id,en}.json            UI strings
drizzle/                         generated migration output (created by Drizzle Kit)
scripts/                          topic and example quiz-question seed scripts
docs/phase-2-architecture.md     implemented Phase 2 decisions and data model
docs/phase-3-architecture.md     Phase 3 adaptive-scheduling plan (not implemented)
docs/deployment-readiness.md     what's been hardened for production, what's still
                                  placeholder, what needs a real decision (Section VIII)
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

| Script | Does |
| --- | --- |
| `pnpm dev` | Runs `next dev` and `velite dev` together (via `concurrently`) — Velite watches `content/` and regenerates its output automatically, nothing to run separately. |
| `pnpm build` | `velite build && next build` — a full production build. |
| `pnpm generate` | `velite build` on its own. Run this once after a fresh clone if your editor complains that `#content` can't be found, or if a typecheck fails before you've ever run `pnpm dev`. |
| `pnpm lint` | Runs the configured Next.js lint command. |
| `pnpm typecheck` | `tsc --noEmit`. Also depends on `.velite/` existing — run `pnpm generate` first if this is the very first command you run after cloning. |
| `pnpm test` | Runs the Vitest test suite once. |
| `pnpm test:watch` | Runs Vitest in watch mode. |
| `pnpm db:generate` | Generates Drizzle migrations from `lib/db/schema.ts`; requires `DATABASE_URL` for Drizzle Kit. |
| `pnpm db:migrate` | Applies Drizzle migrations; requires `DATABASE_URL`. |
| `pnpm db:seed` | Generates Velite output, then seeds topics and one example quiz question per editorial; requires `DATABASE_URL`. |
| `pnpm start` | Serves an already-built app (`next start`). |

### Environment variables

**The public archive needs none of the account variables below.** Accounts, planner pages, quizzes, and auth API routes require a configured database and Better Auth secret. The database and auth clients are lazy, so the archive can still build and run with zero database configuration. Full detail and current defaults live in `.env.example`.

| Variable | Required? | Purpose |
| --- | --- | --- |
| `KEYSTATIC_GITHUB_CLIENT_ID` / `KEYSTATIC_GITHUB_CLIENT_SECRET` | Optional | Switches Keystatic from local-storage mode to GitHub-storage mode. Without it, `/keystatic` edits your local working copy directly — nothing to configure. **Also controls whether `/keystatic` is reachable at all once deployed** — see [Section VI](#vi-editing-content-in-the-browser-keystatic). |
| `KEYSTATIC_SECRET` | Optional | Required alongside the two above for GitHub-storage mode. Generate with `openssl rand -base64 32`. |
| `KEYSTATIC_GITHUB_REPO` | Optional | Which repo Keystatic commits to in GitHub-storage mode. Defaults to `project-cherenkov/project-cherenkov-app` if unset — only needed if you're running a fork under a different name. |
| `BLOB_READ_WRITE_TOKEN` | Optional | Powers the team-photo upload path. Without it, that route returns a clear error instead of failing inside Vercel Blob's own API. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Absolute origin used by `app/sitemap.ts`, `app/robots.ts`, and Open Graph metadata. Falls back to `http://localhost:3000` if unset — set it to `https://project-cherenkov-app.vercel.app` in Vercel, or replace it with the eventual custom domain. |
| `DATABASE_URL` | Required for accounts/planner | Neon/Postgres connection string used by Drizzle and Better Auth. Not needed for the public archive or CI's unit tests. |
| `BETTER_AUTH_SECRET` | Required for accounts/planner | Secret used by Better Auth for sessions. |
| `BETTER_AUTH_URL` | Recommended for accounts/planner | Canonical application URL used by Better Auth; use the deployed origin in production. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Enables the "Continue with Google" buttons and Google OAuth. Email/password remains available without these. |

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
| `principle` | string | The general idea this editorial teaches. **Free text on purpose** — see [Section X](#x-open-questions--known-placeholders). |
| `errorType` | string, optional | The specific mistake this editorial corrects. Also free text. |
| `vizEngine` | `"graph-array-stepper"` \| `"trajectory-sandbox"` \| `"orbital-sandbox"` \| `"none"` | Which of the three engines to render. `"none"` is a legal schema value but a flagged content error in the UI — see FAQ C. |
| `vizConfig` | object, shape depends on `vizEngine` | See the three tables below. |
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

---

## **VI. Editing Content in the Browser (Keystatic)**

`/keystatic` mirrors `velite.config.ts`'s schema field-for-field: three collections (one per subject, each hardcoded to its own `content/editorials/<subject>/*` path, so a folder/frontmatter subject mismatch is structurally impossible) plus a `team` singleton backing the About page's team list.

**Two storage modes**, chosen automatically by whether `KEYSTATIC_GITHUB_CLIENT_ID` is set (`keystatic.config.ts`):

- **Local** (default, no env vars): edits write straight to your working copy on disk. This is the right mode for local development, and the only mode local development needs.
- **GitHub** (`KEYSTATIC_GITHUB_CLIENT_ID`/`_SECRET`/`KEYSTATIC_GITHUB_REPO` set): edits go through a real GitHub OAuth flow and land as commits against the repo, gated by the logged-in user's actual GitHub repo permissions.

**On a deployed build, `/keystatic`, `/api/keystatic/*`, and `/api/team-photo` are only reachable in GitHub-storage mode** — `lib/admin-guard.ts` returns a 404 for all three otherwise, enforced at the edge in `middleware.ts`. See FAQ A for why: local-storage mode has no authentication of its own, and a deployed server's filesystem doesn't persist writes between requests anyway, so leaving it reachable in production would serve a live-looking but non-functional CMS to any visitor — and separately, would leave the team-photo upload endpoint open to the entire internet the moment `BLOB_READ_WRITE_TOKEN` exists.

Until a GitHub OAuth App is set up for real, editing content in production means editing MDX files directly and pushing — exactly how it already works without Keystatic at all.

---

## **VII. Internationalization**

Locales live in `messages/id.json` and `messages/en.json`, same keys in both, loaded via `i18n/request.ts`. Every route is locale-prefixed (`middleware.ts` + `i18n/routing.ts`) — `id` is the default locale but still gets its own `/id` prefix rather than living at the bare root.

To add a locale: add it to `i18n/routing.ts`'s `locales` array and add a matching `messages/<locale>.json`.

---

## **VIII. Deploying**

The public archive is deployed on Vercel at [project-cherenkov-app.vercel.app](https://project-cherenkov-app.vercel.app/). It can be deployed with **zero required environment variables** for the archive-only experience.

1. **Push to GitHub.** This repo lives at [`github.com/project-cherenkov/project-cherenkov-app`](https://github.com/project-cherenkov/project-cherenkov-app) (currently private — see [Section X](#x-open-questions--known-placeholders) for what that means for the site's own "built in the open" copy).
2. **Import the repo in [Vercel](https://vercel.com/new).** Next.js is auto-detected; no `vercel.json` or custom build command is needed.
3. **Deploy.** No environment variables are required for the archive, i18n, or MDX pipeline.
4. **Set `NEXT_PUBLIC_SITE_URL`** to `https://project-cherenkov-app.vercel.app` (or the eventual custom domain) in Vercel so the sitemap and Open Graph metadata use the deployed origin instead of `localhost`.
5. **Every PR gets its own preview deploy** automatically (Vercel's default behavior for a connected repo) — nothing extra to configure.
6. **CI runs independently of Vercel.** `.github/workflows/ci.yml` runs install → `pnpm generate` → lint → typecheck → test → build on every push/PR, so a broken build or failing test is visible on GitHub as well as through Vercel's deployment checks.

**Before a real public launch** (as opposed to a working preview), read `docs/deployment-readiness.md` and resolve:

- The placeholder hero/tagline/about copy in `messages/*.json` — until it's real, every page ships with `robots: { index: false, follow: false }` on purpose (`app/[locale]/layout.tsx`), so search engines don't index placeholder text.
- The repo-visibility mismatch noted in [Section X](#x-open-questions--known-placeholders).
- Whether/when to set up a real GitHub OAuth App so `/keystatic` becomes reachable in production (Section VI).

None of the above block deploying the code today — they block treating the result as a finished public launch rather than a working preview.

---

## **IX. FAQ**

### **A. "Why does `/keystatic` 404 on Vercel until I set up GitHub OAuth?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

Local-storage Keystatic — the default, with no env vars set — has no authentication of its own; it's built to be run by whoever is already running `pnpm dev` on their own machine. Nothing stopped it from being reachable on a real deployment too, which is a problem for two separate reasons: a serverless deployment's filesystem doesn't persist writes between requests, so `/keystatic` would present a live-looking but non-functional editing UI to anyone who found the URL; and independently, `app/api/team-photo/route.ts` is a public `POST` endpoint the moment `BLOB_READ_WRITE_TOKEN` is set, regardless of Keystatic's own storage mode.

`lib/admin-guard.ts` closes both at once: on a deployed build (`NODE_ENV === "production"`, which Vercel sets for both preview and production deploys), `/keystatic`, `/api/keystatic/*`, and `/api/team-photo` all 404 unless `KEYSTATIC_GITHUB_CLIENT_ID` is set — at which point GitHub OAuth plus the logged-in user's actual repo permissions become the real access control. Local `pnpm dev` is unaffected either way.

</details>

### **B. "I forgot to add `<Interactive />` to my editorial — what happens?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

The visualization still renders — right after the hook, with a small notice — rather than the editorial silently publishing with no interactive at all. Every published editorial is supposed to ship a working visualization (see FAQ C for the one exception), so the fallback errs toward "show it somewhere" over "fail silently." Placing `<Interactive />` yourself just controls *where* it lands, which reads better than the automatic placement.

</details>

### **C. "Why can `vizEngine` still be `"none"` if every editorial is supposed to have a visualization?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

This is a flagged, unresolved conflict between two parts of the original build spec, not an oversight: one line states every published editorial *must* ship a working interactive visualization; the frontmatter schema section of the same spec lists `"none"` as a legal `vizEngine` value. `velite.config.ts` keeps `"none"` as valid at the schema level — so nothing here silently forecloses the option — but `lib/content.ts`'s `hasMissingViz()` treats it as a flagged content error the UI surfaces, not a legitimate published state. Which rule should actually win is still an open question; see [Section X](#x-open-questions--known-placeholders).

</details>

### **D. "Why are `principle` and `errorType` free text instead of a fixed list?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

The taxonomy isn't finalized yet, and there isn't enough real content to know what the actual vocabulary should be — tightening these to a `z.enum([...])` in `velite.config.ts` before that's known would mean guessing at categories rather than deriving them from what actually gets written. Once there are enough real editorials to see the real vocabulary, `velite.config.ts` is the only file that needs to change.

</details>

### **E. "The About page says the project is 'built in the open' but the repo is private — is that a bug?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

Not a bug — a flagged, unresolved mismatch. The About page's copy and the header's public GitHub link both currently point at `github.com/project-cherenkov/project-cherenkov-app`, which is real but private, so a visitor who isn't a collaborator can't actually open it. This wasn't silently fixed by guessing at intent (make the repo public? change the copy?) — see [Section X](#x-open-questions--known-placeholders) and `docs/deployment-readiness.md` for the two ways to resolve it.

</details>

---

## **X. Open Questions & Known Placeholders**

These were left as clearly-marked placeholders rather than decided unilaterally — search the codebase for `PLACEHOLDER` to find every instance:

- **Typography.** No typeface has been chosen. `tailwind.config.ts` currently falls back to the system font stack so nothing renders broken — swap `fontFamily.sans` there once it's decided.
- **`principle` / `errorType` taxonomy** — see FAQ D.
- **Repo visibility.** The repo is private, but the About page's "built in the open" copy and the header's public GitHub link both promise access a public visitor won't have — see FAQ E. Resolve by making the repo public before launch, or by adjusting that copy/link.
- **Author names.** All three example editorials use `"PLACEHOLDER Author Name"`.
- **Hero/footer copy.** `messages/*.json` has several `[PLACEHOLDER — ...]` strings for copy that wasn't provided (hero headline, taglines, about-page philosophy and team bios) — this is also why every page currently ships `noindex` (see [Section VIII](#viii-deploying)).
- **Google OAuth deployment setup.** Google is the selected optional provider;
  the OAuth credentials and callback configuration still need to be created
  before enabling that sign-in path in a deployed environment.
- **`vizEngine: "none"` spec conflict** — see FAQ C.
- **Team-photo upload authorization, once Keystatic's admin surface is enabled in production.** Enabling GitHub-storage mode makes `/keystatic` itself OAuth-gated; `/api/team-photo` additionally requires an authenticated email listed in `ADMIN_EMAILS`.
