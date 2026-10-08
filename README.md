# **Project Cherenkov**

## **Table of Contents**

1. [Short Description](#i-short-description)
2. [Tech Stack & Hosting](#ii-tech-stack--hosting)
3. [Project Structure](#iii-project-structure)
4. [Getting Started](#iv-getting-started)
5. [Content Model — Writing an Editorial](#v-content-model--writing-an-editorial)
6. [Syllabus & Materials](#vi-syllabus--materials) · [Documentation pages (`/docs`)](#vi-b-documentation-pages-docs)
7. [Editing Content in the Browser (Keystatic)](#vii-editing-content-in-the-browser-keystatic)
8. [Composed & Programmable Scenes (the Scene Builder)](#viii-composed--programmable-scenes-the-scene-builder)
9. [Accounts & Study Planner](#ix-accounts--study-planner)
10. [Internationalisation](#x-internationalisation)
11. [Deploying](#xi-deploying)
12. [FAQ](#xii-faq)
13. [Current Status & Open Questions](#xiii-current-status--open-questions)

---

## **I. Short Description**

Project Cherenkov is an Indonesian OSN (olympiad) editorial archive and study planner spanning **informatics, physics, and astronomy**. Each editorial is a rigorous, self-contained write-up of one idea — a proof, a derivation, a technique — and every editorial ships paired with a **working interactive visualisation**, not a decorative one: the visualisation is how the idea is explored, not an illustration bolted on afterwards.

The public site has three sections, joined by the OSN syllabus:

| Section | What it is | Where it lives |
| --- | --- | --- |
| **Syllabus** | The official OSN scope for each subject, topic by topic, showing which topics already have a material and/or editorials. | `lib/syllabus/data/*.ts` (structured data, not MDX) |
| **Materials** | Short, unsigned, topic-by-topic breakdowns of the syllabus. No visualisation requirement. | `content/materials/<subject>/*.mdx` |
| **Editorials** | The archive proper: rigorous write-ups, each with a working visualisation. | `content/editorials/<subject>/*.mdx` |

The editorial archive is indexed by **principle** (the general idea an editorial teaches) and **error type** (the specific mistake it corrects), deliberately **not** by subject chapter — the goal is to let someone arrive because they made a specific mistake or want to understand a specific idea, not because they're browsing a syllabus. (The syllabus and materials sections are the place for browsing by topic.)

This repo contains **Phase 1** (the public archive, syllabus and materials) and the implemented **Phase 2** account and study-planner layer. Visitors can browse, read, and interact with everything in Phase 1 without an account; signed-in users can generate a study plan, track progress through quiz attempts, and open topic pages. Phase 3 adaptive scheduling remains planned but is not implemented — see `docs/phase-3-architecture.md`.

Content is git-committed MDX, not stored in a database: there is no CRUD backend for editorials or materials, only files under `content/`, compiled at build time. Editing happens either by editing those files directly, or through an in-site CMS layer ([Section VII](#vii-editing-content-in-the-browser-keystatic)) that writes back to the same files.

## **Legal & Contact**

- Licence: [LICENSE](LICENSE) (MIT)
- Terms: [TERMS.md](TERMS.md)
- Privacy: [PRIVACY.md](PRIVACY.md)
- Project contact: projectcherenkov@gmail.com

These documents are intentionally kept in dedicated files instead of being buried inside the README. The site footer links to all three, plus the contact address.

---

## **II. Tech Stack & Hosting**

| Layer | Choice | Why |
| --- | --- | --- |
| **Framework** | [Next.js](https://nextjs.org/) 15 (App Router) + React 19 + TypeScript | Server-rendered pages for content that should be crawlable and fast on a first load, with the App Router's per-route code splitting keeping each editorial's (potentially heavy) visualisation out of every other page's bundle. `middleware.ts` opts in to the **Node.js middleware runtime** (stable since Next 15.5) because it checks Better Auth sessions — see [Section IX](#ix-accounts--study-planner). |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) 3 + hand-rolled shadcn/ui-style primitives (`components/ui/`, built on Radix) + [next-themes](https://github.com/pacocoursey/next-themes) | Utility-first styling with design tokens (`tailwind.config.ts`) as the single source of truth for colour/spacing, rather than scattering hex values through components. Light/dark theme follows the system by default, with a manual toggle. |
| **Content pipeline** | MDX compiled with [Velite](https://velite.js.org) | Two collections — `editorials` and `materials` — each with a typed, Zod-validated frontmatter schema (`velite.config.ts`) checked at build time. Visualisation-specific `vizConfig` shapes are additionally checked by runtime type guards because their frontmatter field is intentionally generic. `lib/content.ts` is the only place that touches Velite's generated `#content` output directly; every page goes through it. |
| **Math typesetting** | [KaTeX](https://katex.org/) via `remark-math`/`rehype-katex` | Compiled to static HTML **at build time**, so a reader's browser never runs math-rendering JS or reflows the page after load. |
| **Visualisations** | [D3](https://d3js.org/) (scales only) + Canvas 2D / `requestAnimationFrame` | Five engines (`components/viz/`), dispatched by `vizConfig.discriminant` in an editorial's frontmatter (see [Section V](#v-content-model--writing-an-editorial)): three purpose-built (a graph/array stepper, a trajectory sandbox, an orbital sandbox) plus two authored visually — `composed-scene` (template-driven) and `programmable-scene` (a sandboxed, block-authored program). See [Section VIII](#viii-composed--programmable-scenes-the-scene-builder). D3 is used narrowly for its scale maths, not as a full charting layer, since each engine's rendering is bespoke. |
| **Block editor** | [Blockly](https://developers.google.com/blockly) | Authoring-only dependency of the scene builder's `programmable-scene` mode. It is deliberately kept out of every reader-facing page's JavaScript; `pnpm build` ends with a script that fails the build if it leaks (see [Section IV](#iv-getting-started)). |
| **i18n** | [next-intl](https://next-intl.dev/) | Locale-prefixed routing (`id`/`en`) via `middleware.ts` and `i18n/routing.ts` — see [Section X](#x-internationalisation). |
| **CMS** | [Keystatic](https://keystatic.com/) | In-site editing at `/keystatic`, mirroring `velite.config.ts`'s schema field-for-field (`keystatic.config.ts`): three editorial collections, three materials collections, and a `team` singleton. Local-storage mode in development, GitHub-storage mode (real OAuth-backed auth) in production — see [Section VII](#vii-editing-content-in-the-browser-keystatic). |
| **Image uploads** | [Vercel Blob](https://vercel.com/storage/blob) | Backs the team-photo upload path (`app/api/team-photo/route.ts`, used from `/keystatic/team-photo`). Gated by the same production rule as Keystatic itself, plus a per-request session and `ADMIN_EMAILS` check — see [Section VII](#vii-editing-content-in-the-browser-keystatic). |
| **Database** | [Neon](https://neon.tech/) serverless Postgres | Stores accounts, sessions, topics, quiz questions, quiz attempts, study plans and plan items. |
| **ORM and migrations** | [Drizzle ORM](https://orm.drizzle.team/) | Defines the schema in TypeScript (`lib/db/schema.ts`); migrations are committed under `drizzle/`. |
| **Authentication** | [Better Auth](https://www.better-auth.com/) | Email/password authentication; Google OAuth is optional and only activates when both Google credentials are configured. |
| **Testing** | [Vitest](https://vitest.dev/) | Unit and render-path tests live beside the code they cover (`*.test.ts(x)`), plus `content-integrity.test.ts`, `velite.config.test.ts`, `keystatic.config.test.ts` and `__tests__/middleware.test.ts` at the root. |
| **Package manager** | [pnpm](https://pnpm.io) 9 (pinned via `packageManager` in `package.json`) | — |

**Hosting:** [Vercel](https://vercel.com). The live deployment is available at [project-cherenkov-app.vercel.app/en](https://project-cherenkov-app.vercel.app/en). The repo is public at [github.com/project-cherenkov/project-cherenkov-app](https://github.com/project-cherenkov/project-cherenkov-app). Framework detection is automatic for Next.js — no `vercel.json` is needed. See [Section XI](#xi-deploying) for deployment details.

`next.config.mjs` also applies baseline security headers to every route (`X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`). There is deliberately **no Content-Security-Policy yet**; a real one has to be worked out against Keystatic's admin UI and Vercel Blob's image host (see `docs/deployment-readiness.md`).

Phase 3 adaptive scheduling remains a design document in `docs/phase-3-architecture.md`.

---

## **III. Project Structure**

```text
app/[locale]/                    routes (everything is locale-prefixed)
  page.tsx                       home: hero, calls to action, recent editorials
  syllabus/                      syllabus index; syllabus/[subject]/ for one subject
  materials/                     materials index; materials/[subject]/[slug]/ for one material
  archive/                       editorial listing, filterable by subject/principle/errorType
  archive/[subject]/[slug]/      one editorial's page
  about/                         philosophy, team (from content/team), repo link
  docs/                          documentation: docs/ (index), docs/[slug] (one page) — Section VI-b
  [...rest]/                     catch-all that renders the localized 404 (real routes win)
  layout.tsx                     the ROOT layout: <html lang={locale}>, theme, header/footer, skip link
  opengraph-image.tsx            the site-wide social card (one per locale, built statically)
  login/ signup/                 Better Auth email/password (and optional Google) forms
  planner/                       authenticated plan overview and generation
  planner/[subject]/[chapter]/   topic status, linked editorial, and quiz (the
                                  "chapter" segment actually contains the topic ID)
  error.tsx, not-found.tsx       locale-scoped error and 404 pages
app/keystatic/                   Keystatic admin UI (gated in production — Section VII)
  layout.tsx                     its OWN root layout (<html lang="en">) + the floating
                                  "+ New visualization" button. There is deliberately no
                                  shared app/layout.tsx: the localized site and the admin UI
                                  are two root layouts so <html lang> can follow the URL.
  scene-builder/                 the scene builder page (Section VIII)
  scene-builder/new/             "New visualization" form: creates a stub editorial first
  team-photo/                    team-photo upload page
app/api/auth/[...all]/           Better Auth's catch-all handler
app/api/keystatic/               Keystatic's own API route (gated in production)
app/api/team-photo/              Vercel Blob upload endpoint (gated in production)
app/api/scene-builder/           POST: save a scene into an existing editorial
  new/                           POST: create the stub editorial for a new visualisation
  github-oauth/{start,callback}/ the scene builder's own GitHub OAuth flow
                                  (all gated in production — Section VIII)
app/robots.ts, app/sitemap.ts    generated from the same content queries every page uses; the
                                  sitemap carries hreflang alternates for every URL
app/llms.txt/route.ts            /llms.txt — Markdown map of the site for LLM tools
app/icon.svg                     favicon
components/
  auth/                          login and signup forms
  planner/                       plan overview, plan-generation form, topic view
  quiz/                          quiz dialog
  ui/                            hand-rolled shadcn/ui-style primitives
  site/                          header, footer, cards, filters, archive sub-nav, theme toggle,
                                  syllabus controls, team-photo uploader
  site/scene-builder/            the scene builder UI: palette, inspector, timeline,
                                  Blockly block editor, new-visualisation form
  viz/                           the five visualisation engines, the engine dispatcher
                                  (viz-engine.tsx) and shared playback controls
  viz/composed-scene/            composed-scene engine: element templates + renderer
  viz/programmable-scene/        programmable-scene engine: types, interpreter, component
  editorial-mdx.tsx, material-mdx.tsx   MDX rendering for editorials and materials
content/editorials/<subject>/    the editorial archive (MDX)
content/materials/<subject>/     materials (MDX), one per syllabus topic at most
content/team/                    Keystatic-managed team singleton (About page)
content/docs/<locale>/           documentation pages (MDX), English is the source of truth
lib/content.ts                   all querying/filtering of editorials and materials goes
                                  through here — pages never import Velite's #content directly
lib/syllabus/                    syllabus data (data/{informatics,physics,astronomy}.ts),
                                  types, authoring helpers, lookup functions
lib/library.ts                   joins syllabus + materials + editorials for the syllabus pages
lib/subjects.ts                  the three subjects, shared by runtime code
lib/team.ts                      reads the Keystatic team singleton for the About page
lib/admin-guard.ts               single source of truth for whether /keystatic, the
                                  team-photo route, and the scene-builder routes are
                                  reachable, plus the ADMIN_EMAILS check (Section VII)
lib/site.ts                      shared absolute site URL for sitemap/robots/Open Graph
lib/seo.ts, lib/seo-metadata.ts  canonical/hreflang/Open Graph metadata builders, the indexing
                                  switch, JSON-LD builders (pure, unit-tested)
lib/docs.ts, lib/docs-core.ts,   docs queries + English-fallback logic (core is pure),
  lib/docs-headings.ts            heading ids and table of contents
lib/fonts.ts                     the two next/font families, shared by both root layouts
lib/auth.ts, lib/auth-guard.ts,  Better Auth configuration, session checks, client,
  lib/auth-client.ts,             error-message mapping, safe post-login redirects
  lib/auth-error-messages.ts,
  lib/safe-redirect.ts
lib/planner*.ts, lib/plan-generator.ts,
  lib/quiz*.ts                   plan generation, progress, scoring, and server actions
lib/scene-builder-*.ts           frontmatter write-back (write), stub-editorial creation
                                  (create), GitHub API client (github), and the dedicated
                                  GitHub OAuth flow (oauth, oauth-client) — Section VIII
lib/db/                          Drizzle schema and lazy Neon database client
lib/seed/                        pure logic behind the topic seed script
messages/{id,en}.json            UI strings
i18n/                            next-intl routing and request configuration
drizzle/                         committed SQL migrations (drizzle/meta is git-ignored)
scripts/                         seed-topics.ts, seed-quiz-questions.ts,
                                  check-blockly-bundle-isolation.ts
middleware.ts                    locale routing, admin-surface gate, planner auth gate
docs/                            see the list below
```

**Docs in `docs/`:**

| File | What it is |
| --- | --- |
| `seo-and-accessibility.md` | How indexing is switched on, what each page declares to search engines, the accessibility decisions and how to verify them, and the open launch decisions. |
| `cherenkov-env-vars-guide.md` | Every environment variable, what it unlocks, and how to obtain it, for both local development and Vercel. |
| `scene-builder-github-auth.md` | Walkthrough and troubleshooting for the scene builder's GitHub authorisation step ([FAQ F](#f-why-do-i-see-github-authorization-required-in-the-scene-builder-even-though-im-already-logged-into-keystatic)). |
| `phase-3-architecture.md` | The Phase 3 adaptive-scheduling plan (**not implemented**). It also summarises Phase 2 as built. |
| `phase-2-architecture.md` | The original Phase 2 design sketch. Historical: Phase 2 is built, and its own header says so. |
| `deployment-readiness.md` | The Phase 1 deployment-hardening write-up. Historical: it predates the scene builder, the planner and the syllabus/materials sections, so treat it as context rather than a current file or dependency list. |

---

## **IV. Getting Started**

CI runs on **Node 22**; use the same locally. (The test suite's `jsdom` 30 dependency declares Node `^22.22.2 || ^24.15.0 || >=26`.) Requires [pnpm](https://pnpm.io) 9.

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
| `pnpm build` | `velite build && next build && tsx scripts/check-blockly-bundle-isolation.ts` — a full production build, followed by a check that Blockly's code has not leaked into any reader-facing page's JavaScript. The build fails if it has. |
| `pnpm generate` | `velite build` on its own. Run this once after a fresh clone if your editor complains that `#content` can't be found, or if a typecheck fails before you've ever run `pnpm dev`. |
| `pnpm lint` | `next lint`. |
| `pnpm typecheck` | `tsc --noEmit`. Also depends on `.velite/` existing — run `pnpm generate` first if this is the very first command you run after cloning. |
| `pnpm test` | Runs the Vitest suite once. |
| `pnpm test:watch` | Runs Vitest in watch mode. |
| `pnpm db:generate` | Generates Drizzle migrations from `lib/db/schema.ts`; does not require a database connection. |
| `pnpm db:migrate` | Applies Drizzle migrations; requires `DATABASE_URL`. |
| `pnpm db:seed` | Generates Velite output, then seeds one topic per syllabus topic (`scripts/seed-topics.ts`) and the quiz bank (`scripts/seed-quiz-questions.ts`, add `--prune-legacy` to delete pre-bank questions that have no key); safe to re-run; requires `DATABASE_URL`. |
| `pnpm start` | Serves an already-built app (`next start`). |

### Environment variables

**The public site needs none of the variables below.** Accounts, planner pages, quizzes and auth API routes require a configured database and Better Auth secret. The database and auth clients are lazy, so the archive can still build and run with zero configuration. `.env.example` has the current defaults; [`docs/cherenkov-env-vars-guide.md`](docs/cherenkov-env-vars-guide.md) has the full walkthrough for each variable. The short, deployment-oriented summary:

| Variable | Required? | Purpose | How to get it (summary) |
| --- | --- | --- | --- |
| `KEYSTATIC_GITHUB_CLIENT_ID` / `KEYSTATIC_GITHUB_CLIENT_SECRET` | Optional | Switches Keystatic from local-storage mode to GitHub-storage mode. Without them, `/keystatic` edits your local working copy directly — nothing to configure. **Also controls whether `/keystatic` is reachable at all once deployed** — see [Section VII](#vii-editing-content-in-the-browser-keystatic). The scene builder ([Section VIII](#viii-composed--programmable-scenes-the-scene-builder)) reuses the same two variables to drive its own, separate GitHub OAuth flow. | Create a GitHub OAuth App under GitHub → Settings → Developer settings → OAuth Apps; set the homepage to your deployed URL and the callback to `https://<your-domain>/api/keystatic/github/oauth/callback`. |
| `KEYSTATIC_SECRET` | Required in production whenever `KEYSTATIC_GITHUB_CLIENT_ID` is set | Signs Keystatic's GitHub-mode session and the scene builder's short-lived GitHub-token cookie. **If the client ID is set but this is not, the whole admin surface stays disabled in production** (`lib/admin-guard.ts` fails closed rather than signing cookies with a guessable secret). | Run `openssl rand -base64 32` and paste the result. |
| `NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED` | **Do not set** | A client-visible boolean that `next.config.mjs` derives automatically from `KEYSTATIC_GITHUB_CLIENT_ID` at build time, so the browser and server agree on Keystatic's storage mode. Setting it by hand just creates a way for the two to disagree. | Nothing to do. |
| `KEYSTATIC_GITHUB_REPO` | Optional | Which repo Keystatic and the scene builder commit to in GitHub-storage mode. Defaults to `project-cherenkov/project-cherenkov-app` if unset — only needed if you're running a fork under a different name. | Usually leave unset. |
| `ADMIN_EMAILS` | Required for team-photo uploads **and** the scene builder (save and "New visualization") | Comma-separated email allow-list for content editors. These routes require both an authenticated session and a matching email — **in local mode too**, so saving from the scene builder locally needs the Phase 2 account variables below as well. | Add a list such as `editor@example.com, second-editor@example.com` to `.env.local` or Vercel's environment variables. |
| `BLOB_READ_WRITE_TOKEN` | Required for team-photo uploads | Powers the upload after authorisation succeeds. Without it, the route returns a clear error instead of failing inside Vercel Blob's own API. | Create a Vercel Blob store in the project, link it, and let Vercel create the variable automatically. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Absolute origin used by `app/sitemap.ts`, `app/robots.ts`, and Open Graph metadata. Falls back to `http://localhost:3000` if unset — set it to `https://project-cherenkov-app.vercel.app` in Vercel, or to the eventual custom domain. | Use the deployed origin. |
| `NEXT_PUBLIC_ALLOW_INDEXING` | Optional | **The switch that lets search engines index the site.** Unset (the default) = every page is `noindex, nofollow`. Set to `1` to make public pages indexable; account, login, signup and planner pages stay `noindex` regardless, as do editorials still carrying a placeholder author. Also controls whether `/llms.txt` lists the site. See [FAQ E](#e-is-the-site-ready-to-be-indexed) and `docs/seo-and-accessibility.md`. | Set to `1` in Vercel once the launch checklist in `docs/seo-and-accessibility.md` is done. |
| `DATABASE_URL` | Required for accounts/planner | Neon/Postgres connection string used by Drizzle and Better Auth. Not needed for the public site or CI's unit tests. | Create a Neon project and copy the connection string from Neon → Connection Details. |
| `BETTER_AUTH_SECRET` | Required for accounts/planner | Secret used by Better Auth for sessions. | Run `openssl rand -base64 32` and paste the result. |
| `BETTER_AUTH_URL` | Recommended for accounts/planner | Canonical application URL used by Better Auth; use the deployed origin in production. | Set to your deployed origin. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Enables the "Continue with Google" buttons and Google OAuth. Email/password remains available without these. | Create a Google OAuth web client in Google Cloud Console and add the callback URL `https://<your-domain>/api/auth/callback/google`. |

Without `DATABASE_URL`, requests to authenticated features fail closed as unauthenticated rather than making the public site unavailable.

---

## **V. Content Model — Writing an Editorial**

Add a `.mdx` file under `content/editorials/<subject>/`. Frontmatter is validated by `velite.config.ts` at build time:

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string, ≤120 chars | — |
| `subject` | `"informatics"` \| `"physics"` \| `"astronomy"` | Must match the folder it's in — the three Keystatic collections enforce this structurally (see [Section VII](#vii-editing-content-in-the-browser-keystatic)). |
| `hook` | string, ≤280 chars | One sentence that makes someone want to read on. |
| `tags` | string[] | Short, lowercase. |
| `principle` | string | The general idea this editorial teaches. **Free text on purpose** — see [Section XIII](#xiii-current-status--open-questions). |
| `errorType` | string, optional | The specific mistake this editorial corrects. Also free text. |
| `vizConfig` | `{ discriminant, value }` | `discriminant` is `"graph-array-stepper"` \| `"trajectory-sandbox"` \| `"orbital-sandbox"` \| `"composed-scene"` \| `"programmable-scene"` \| `"none"` — which engine to render. `value` is that engine's own config object; see the engine-by-engine notes below. The first three engines are hand-written per visualisation type; `composed-scene` and `programmable-scene` are authored visually rather than by hand — see [Section VIII](#viii-composed--programmable-scenes-the-scene-builder). `"none"` is a legal schema value but a flagged content error in the UI — see FAQ C. There is no separate `vizEngine` frontmatter key — `discriminant` is the sole engine selector, in both the real content files and the Keystatic CMS field config. |
| `publishedAt` | ISO date, year 2020 or later | Earlier dates are rejected at build time as placeholder/test data. |
| `author` | string | — |
| `syllabusTopic` | string, optional | A topic `id` from the syllabus for the same subject, linking the editorial into the syllabus pages. See [Section VI](#vi-syllabus--materials). |
| body | MDX | Everything after the frontmatter. |
| `slug` | *(derived, not frontmatter)* | Taken from the filename, not the title — retitling a published piece never silently changes its URL. |

Body is regular Markdown/MDX. Use `$...$` for inline math and `$$...$$` for display math — it's compiled to static KaTeX HTML at build time (see [Section II](#ii-tech-stack--hosting)), so there's no math-rendering JS shipped to the reader.

Place `<Interactive />` on its own line wherever the visualisation should sit — typically between "the idea" and "the full proof." **If you forget it, the visualisation still renders** (right after the hook, with a small notice) rather than silently publishing an editorial with no interactive — see FAQ B for exactly why it's built this way. Placing the tag yourself just gives you control over where it lands, which reads better.

Real, complete examples to copy from:

- `content/editorials/informatics/binary-search-on-answer.mdx` (`graph-array-stepper`)
- `content/editorials/physics/projectile-range-symmetry.mdx` (`trajectory-sandbox`)
- `content/editorials/astronomy/eccentric-transit-duration.mdx` (`orbital-sandbox`)

There is also `content/editorials/informatics/programmable-scene-fixture.mdx` (`programmable-scene`). It is an **implementation fixture, not a real editorial**: a one-circle program that exists to prove the engine round-trips end to end. It has a placeholder author and currently appears in the archive like any other editorial. No editorial uses `composed-scene` yet.

### `vizConfig` by engine

**`graph-array-stepper`** — an array with precomputed steps (pointers, highlighted cells, a one-line note per step). Frontmatter is static data, not code, so there's no literal "step function": you write out each step's state directly.

```yaml
vizConfig:
  discriminant: graph-array-stepper
  value:
    array: [2, 4, 6, 8, 10]
    steps:
      - pointers: { lo: 0, hi: 4, mid: 2 }
        highlight: [2]
        note: "What's happening at this step."
```

**`trajectory-sandbox`** — adjustable initial speed/angle, animated on a canvas. `physicsType` selects a named physics function from a small registry in `components/viz/trajectory-sandbox/physics-functions.ts` (same reason as above: frontmatter can't hold a real function). Currently only `"projectile"` exists; adding a new scenario means adding one entry to that registry.

```yaml
vizConfig:
  discriminant: trajectory-sandbox
  value:
    physicsType: projectile
    gravity: 9.8
    initial: { speed: 20, angleDeg: 45 }
    speedRange: [5, 40] # optional slider bounds
    angleRange: [5, 85]
```

**`orbital-sandbox`** — eccentricity + mass ratio sliders driving a Kepler-accurate orbit and a simplified, clearly-labelled-as-schematic transit light curve (periapsis-aligned transit; see the astronomy example for the derivation and its stated limits). Eccentricity must satisfy `0 ≤ e < 1`; `semiMajorAxisPx` and `periodSeconds` must be positive.

```yaml
vizConfig:
  discriminant: orbital-sandbox
  value:
    eccentricity: 0.3
    semiMajorAxisPx: 130
    periodSeconds: 6
    massRatio: 0.05 # optional, default 0.05
    transitDepth: 0.015 # optional, default 0.01
    eccentricityRange: [0, 0.9] # optional slider bounds
    massRatioRange: [0.01, 0.2] # optional slider bounds
```

**`composed-scene`** — a general-purpose engine: a scene made of reusable element templates (shapes, curves, text, a slider-bound marker, an array-with-pointers widget) instead of one bespoke renderer per visualisation type. Its `vizConfig.value` is a structured object (canvas size, elements, optional controls, optional steps) that's impractical to hand-write in frontmatter — it's authored visually instead, at `/keystatic/scene-builder`. See [Section VIII](#viii-composed--programmable-scenes-the-scene-builder) for the full shape and the authoring workflow.

**`programmable-scene`** — a scene authored as a small, sandboxed *program* (a recursive `ProgramNode` tree — see `components/viz/programmable-scene/types.ts`) rather than a static config, built visually with a Blockly block editor in the same scene builder. It can be saved straight into an editorial from the builder, like `composed-scene`. See [Section VIII](#viii-composed--programmable-scenes-the-scene-builder).

---

## **VI. Syllabus & Materials**

The syllabus is the spine that joins materials and editorials.

- **Source of truth.** `lib/syllabus/data/{informatics,physics,astronomy}.ts` — structured TypeScript, not MDX. Each subject is a list of sections (theory sections hold linkable topics; practical sections carry only a free-text note) and each topic has a stable `id` and a name in both locales.
- **Stable IDs.** A material points at a topic with `topic:`; an editorial points at one with the optional `syllabusTopic:`. **Never rename a topic `id`** — change its `name` instead. `content-integrity.test.ts` fails if either points at a topic that doesn't exist, if a material's `subject` doesn't match its folder, or if two materials claim the same topic.
- **One material per topic.** Materials are unsigned (no author), have no `principle`/`errorType`, and have no visualisation requirement. Editorials keep all of their rules.
- **Adding a material.** Create it in Keystatic ("Materials — <subject>") and pick the syllabus topic from the dropdown (so a topic ID can't be mistyped), or add `content/materials/<subject>/<slug>.mdx` by hand with `title`, `subject`, `topic`, `summary` (≤280 chars) and a body. `content/materials/informatics/binary-search.mdx` is the starter example.
- **Linking an editorial.** Pick a "Syllabus topic (optional)" in the editorial's Keystatic form, or set `syllabusTopic:` in its frontmatter.
- **Languages.** Names are stored in both locales. Only one language per subject is the official wording (`sourceLang`); the other is an unofficial gloss, and the page says so.
- **Routes.** `/syllabus`, `/syllabus/[subject]`, `/materials`, `/materials/[subject]/[slug]`. The header's "Archive" bookmark groups all three sections (Syllabus, Materials, Editorials), and the sitemap includes the syllabus and materials pages.

---

## **VI-b. Documentation Pages (`/docs`)**

Reader- and contributor-facing documentation lives **inside this app**, not in a separate site: `content/docs/<locale>/<slug>.mdx`, compiled by Velite into a third collection (`docs`) next to editorials and materials, and rendered at `/[locale]/docs` and `/[locale]/docs/[slug]` with the same header, theme, i18n and design tokens as everything else.

- **Adding a page.** Create `content/docs/en/<slug>.mdx` with `title`, `description` (≤200 chars, used as the meta description), `section` (`start` | `reading` | `contributing`), optional `order` (lower first) and optional `updatedAt` (ISO date). Don't add a `# H1` — the page title is the `h1`. `## ` and `### ` headings get anchor ids and an automatic "On this page" list. Link between docs with plain `/docs/<slug>` paths; `content-integrity.test.ts` fails on a link to a page that doesn't exist.
- **Translating.** Add a file with the **same name** under `content/docs/id/`. Until then the Indonesian site shows the English page with a translated notice, `lang="en"` on the text, `noindex`, and a canonical pointing at the English URL — and the sitemap lists only the language a page truly exists in.
- **Not published here.** The developer notes in this repository's top-level `docs/` folder (environment variables, deployment, architecture) are deliberately **not** part of the site. They describe how the deployment is configured and belong on GitHub.

---

## **VII. Editing Content in the Browser (Keystatic)**

`/keystatic` mirrors `velite.config.ts`'s schema field-for-field. It has:

- three **editorial** collections (one per subject, each hardcoded to its own `content/editorials/<subject>/*` path),
- three **materials** collections (one per subject, `content/materials/<subject>/*`), and
- a `team` singleton backing the About page's team list.

Because each collection hardcodes its subject, a folder/frontmatter subject mismatch is structurally impossible. A floating **"+ New visualization"** button (added by `app/keystatic/layout.tsx`) appears on every `/keystatic` screen and opens the scene builder's creation flow ([Section VIII](#viii-composed--programmable-scenes-the-scene-builder)).

**Two storage modes**, chosen automatically by whether `KEYSTATIC_GITHUB_CLIENT_ID` is set (`next.config.mjs` mirrors that into `NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED`, which `keystatic.config.ts` reads so client and server always agree):

- **Local** (default, no env vars): edits write straight to your working copy on disk. This is the right mode for local development, and the only mode local development needs.
- **GitHub** (`KEYSTATIC_GITHUB_CLIENT_ID`/`_SECRET`/`KEYSTATIC_SECRET`, and optionally `KEYSTATIC_GITHUB_REPO`, set): edits go through a real GitHub OAuth flow and land as commits on `keystatic/`-prefixed branches of the repo, gated by the logged-in user's actual GitHub repo permissions.

**On a deployed build, `/keystatic`, `/api/keystatic/*`, `/api/team-photo` and `/api/scene-builder/*` are only reachable in GitHub-storage mode** — and only when `KEYSTATIC_SECRET` is also set. `lib/admin-guard.ts` returns a 404 for all of them otherwise, enforced at the edge in `middleware.ts` (`/keystatic/scene-builder` and `/keystatic/scene-builder/new` need no separate entries there — they already fall under the `/keystatic` prefix). See FAQ A for why: local-storage mode has no authentication of its own, and a deployed server's filesystem doesn't persist writes between requests anyway, so leaving it reachable in production would serve a live-looking but non-functional CMS to any visitor — and separately, would leave the team-photo upload endpoint open to the entire internet the moment `BLOB_READ_WRITE_TOKEN` exists.

Reaching the surface is not the same as being allowed to use it: the team-photo and scene-builder handlers each separately require a signed-in Better Auth user whose email is in `ADMIN_EMAILS`.

Until a GitHub OAuth App is set up for real, editing content in production means editing MDX files directly and pushing — exactly how it already works without Keystatic at all.

---

## **VIII. Composed & Programmable Scenes (the Scene Builder)**

The three hand-written engines in [Section V](#v-content-model--writing-an-editorial) each serve one kind of visualisation. Two further engines cover whatever those don't, and are authored visually at **`/keystatic/scene-builder`** instead of by hand:

- **`composed-scene`** — assemble a scene from a fixed library of reusable **element templates**; the engine (`components/viz/composed-scene/`) interprets that data at render time on a Canvas 2D surface.
- **`programmable-scene`** — assemble a small **program** from Blockly blocks; a sandboxed interpreter (`components/viz/programmable-scene/`) runs it every frame and draws the elements it emits, using the same templates and renderer as `composed-scene`.

Both are dynamically imported in `components/viz/viz-engine.tsx` (with `ssr: false`), the same code-splitting treatment as the other three engines.

### Composed scenes

#### The `vizConfig` shape

As with every other engine (see [Section V](#v-content-model--writing-an-editorial)), `vizConfig` is `{ discriminant: "composed-scene", value: {...} }` — the shape below is `value`:

```yaml
vizConfig:
  discriminant: composed-scene
  value:
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

- **`canvas`** — a fixed design-space width/height in pixels that every element's coordinates are authored against; the scene derives one uniform scale factor from the actual rendered container width, so a scene composed at one size still renders correctly at another.
- **`elements`** (required, 1–12 — `MAX_ELEMENTS` in `components/viz/composed-scene/types.ts`) — each has a stable `id`, a `templateId` naming one of the eleven registered templates below, an optional author-facing `label`, and a `params` object matching that template's own declared parameter schema.
- **`controls`** (optional) — sliders or toggles bound to one element's one param via `bindsTo: { elementId, paramKey }`; a slider can only bind to a numeric param, a toggle only to a boolean one.
- **`steps`** (optional, 0–20 — `MAX_STEPS`) — the same authoring shape as `graph-array-stepper`'s `steps`, generalised: each step is an optional Markdown/KaTeX `note` plus sparse per-element `overrides` (only the params that change need to be listed; anything omitted keeps that element's base `params` value).

#### The eleven element templates

Registered in `components/viz/composed-scene/element-templates.ts` (`ELEMENT_TEMPLATES`) — adding a new one means adding one entry there, never a schema change:

| Template ID | What it draws |
| --- | --- |
| `shape-circle` | A filled circle (position, radius, colour). |
| `shape-rect` | A filled rectangle (position, width, height, colour). |
| `shape-line` | A straight line between two points. |
| `shape-arrow` | A line with an arrowhead at its second point. |
| `text-label` | Literal display text — never evaluated as an expression or formula. |
| `curve-linear` / `curve-quadratic` / `curve-sine` | Named curve shapes between/around control points. |
| `curve-points` | A polyline through 2–4 author-placed points. |
| `slider-marker` | A small marker styled specifically as "the thing a slider moves" (distinct from `shape-circle` mainly so the builder's palette carries an obvious "bind a slider to this" card). |
| `array-pointers` | An array-with-pointers widget (up to 8 cells, up to 3 named pointers, one highlighted index) — a bounded, Canvas-rendered adaptation of `graph-array-stepper`'s own array visual, for composing it alongside other elements in one scene. |

Every param on every template is a number, a bounded select, a boolean, or short plain text — deliberately never a freeform formula/expression field, so a composed scene can never encode arbitrary logic.

### Programmable scenes

A `programmable-scene` config is `{ canvas, program, controls? }`:

```yaml
vizConfig:
  discriminant: programmable-scene
  value:
    canvas: { widthPx: 320, heightPx: 200 }
    program:
      kind: sequence
      body:
        - kind: emitElement
          templateId: shape-circle
          params:
            x: { kind: literal, value: 160 }
            y: { kind: literal, value: 100 }
            radius: { kind: literal, value: 30 }
            color: { kind: literal, value: blue }
    controls: []                 # optional sliders/toggles, read in the program as { kind: input, name: "control:<id>" }
```

- **Program nodes.** `literal`, `variableGet`, `variableSet`, `input` (`t` for elapsed seconds, or `control:<id>`), `arithmetic` (`+ - * /`), `comparison` (`< <= = >= >`), `boolean` (`and`/`or`/`not`), `if`, `repeat`, `emitElement`, and `sequence`. The type definition in `components/viz/programmable-scene/types.ts` is the reference.
- **Sandboxed by construction.** The interpreter (`interpreter.ts`) contains no `eval` or `Function` usage (asserted by `no-eval.test.ts`). It runs under bounded work: `repeat` counts are clamped to 64 (`MAX_REPEAT`) before the loop starts, at most 12 elements are emitted per frame (the shared `MAX_ELEMENTS`), and each frame has an evaluation budget of 5,000 AST nodes (`OPERATION_BUDGET`). A program that exceeds the budget keeps its last drawn frame and shows a notice.
- **Elements come from the same eleven templates** listed above, so `emitElement` can only create things `composed-scene` could draw.
- **Blockly stays out of the reader bundle.** Blockly is only imported by the authoring UI. `pnpm build` finishes by running `scripts/check-blockly-bundle-isolation.ts`, which fails the build if a Blockly-only marker appears in any reader-facing chunk.

### Validation

`isComposedSceneConfig` (`components/viz/composed-scene/types.ts`) and `isProgrammableSceneConfig` (`components/viz/programmable-scene/types.ts`) are the single guards used wherever the matching config is trusted: by `viz-engine.tsx` before rendering a published editorial, by `lib/scene-builder-write.ts` before writing anything back to a file, and by the scene builder UI before enabling its "Save" button — so what counts as valid is defined once, not reimplemented per call site. For composed scenes they check that every `templateId` is registered, every param matches its template's declared type and bounds, and every `elementId` a control or step references actually exists.

### The authoring tool: `/keystatic/scene-builder`

An **Engine** switch at the top selects composed or programmable mode.

**Composed mode** is a three-pane UI (`components/site/scene-builder/`):

- **Palette** — add an element from any of the eleven templates (disabled once the 12-element cap is hit).
- **Canvas preview + timeline** — a live `ComposedScene` render of the current draft, plus a step-by-step timeline editor for adding/reordering/removing steps.
- **Inspector** — edit the selected element's label and params, bind/unbind sliders and toggles, and edit the current step's per-element overrides.

**Programmable mode** replaces these with a Blockly block editor and a live `ProgrammableScene` preview of the compiled program. "Save to editorial" is enabled once the program validates.

#### Starting a new visualisation

The floating **"+ New visualization"** button in `/keystatic` (or `/keystatic/scene-builder/new` directly) asks for a subject, slug, title and engine. It calls `POST /api/scene-builder/new`, which creates a **stub editorial** — title filled in, every other required field set to a clearly marked `PLACEHOLDER`, `vizConfig` starting on `none` — and then opens the scene builder already targeted at it (`?subject=&slug=&engine=`). The stub is a draft to finish, not something to publish as-is.

You can also reach the builder from an existing editorial's `vizConfig` field description inside `/keystatic` (pre-filled with that editorial's `?subject=&slug=`), or directly, with its own subject/slug fields as a fallback for retargeting a draft in progress.

> **Known limitation.** Keystatic's own editorial form can't render the `composed-scene`/`programmable-scene` branches of `vizConfig` (they are empty placeholders there), so an editorial that *already uses* one of them fails to load in the Keystatic form. Create and edit those through the scene builder, and edit their prose in the MDX file directly. Note also that the form's description text for `programmable-scene` still says saving isn't wired up and to copy the output by hand; that text is out of date — saving works (see below).

#### Saving

**Saving** posts the draft to `POST /api/scene-builder` (with `engine` set to `composed-scene` or `programmable-scene`), which requires both an authenticated session and an email in `ADMIN_EMAILS` (the same authorisation `/api/team-photo` uses). It then rewrites only the target editorial's `vizConfig` frontmatter key (`{ discriminant: <engine>, value: <the draft> }`) — the MDX body and every other frontmatter key are left untouched (verified byte-for-byte against real editorials in `scene-builder-write.test.ts`'s round-trip suite). Which storage path it writes to is chosen by the same signal Keystatic itself uses:

- **Local** (default, no env vars): writes the change straight to the target file on disk.
- **GitHub** (`KEYSTATIC_GITHUB_CLIENT_ID` set): commits the change to a brand-new branch (`keystatic/scene-builder-<slug>-<timestamp>`; `keystatic/scene-builder-create-<slug>-<timestamp>` for a new stub) off the repository's default branch. **This does not open or merge a pull request automatically** — the author still opens a PR on GitHub to actually publish the change.

GitHub mode needs its own authorisation step first, via a **dedicated GitHub OAuth flow** (`app/api/scene-builder/github-oauth/{start,callback}/route.ts`, `lib/scene-builder-oauth.ts`) — deliberately separate from both Keystatic's own admin-UI session and Better Auth's session, so that a temporary, deployment-mode-specific OAuth token never needs a schema migration onto the durable user/session tables. It reuses the already-configured `KEYSTATIC_GITHUB_CLIENT_ID`/`KEYSTATIC_GITHUB_CLIENT_SECRET`/`KEYSTATIC_SECRET` variables rather than provisioning new ones, and keeps the resulting GitHub access token in its own short-lived (1 hour), HMAC-signed, `httpOnly` cookie. Hitting a "GitHub authorization required" 401 from either "Save to editorial" or "New visualization" means this step hasn't been done yet (or its token expired) — see [`docs/scene-builder-github-auth.md`](docs/scene-builder-github-auth.md) for the walkthrough and troubleshooting checklist (also linked from FAQ F below).

**Access is gated the same way as the rest of the CMS write surface**: `/keystatic/scene-builder`, `/api/scene-builder/*` and the OAuth routes all fall under `middleware.ts`'s admin-surface gate ([Section VII](#vii-editing-content-in-the-browser-keystatic)), so on a deployed build they 404 together with `/keystatic` unless GitHub-storage mode is configured — and each API handler separately re-checks the caller's session and `ADMIN_EMAILS` membership per request, the same defence-in-depth pattern `/api/team-photo` uses.

---

## **IX. Accounts & Study Planner**

Phase 2 is implemented. It is entirely optional for visitors — the archive, syllabus and materials never require an account.

- **Accounts.** Better Auth with email/password, plus Google OAuth when both Google variables are set (the "Continue with Google" buttons only render then). Sign-in and sign-up live at `/[locale]/login` and `/[locale]/signup`; post-login redirects go through `lib/safe-redirect.ts`.
- **The gate.** `middleware.ts` redirects any unauthenticated request under `/[locale]/planner` to the login page, carrying a `?next=` return path. With no `DATABASE_URL`, session checks fail closed (treated as unauthenticated), so the planner redirects rather than erroring.
- **Topics.** Planner topics are rows in the `topics` table, derived from the **syllabus** (`lib/syllabus`) by `pnpm db:seed` (`scripts/seed-topics.ts`): one row per theory topic, keyed by `(subject, syllabus_topic_id)`, in syllabus order. An editorial is attached to a topic when its `syllabusTopic` frontmatter points there. Rows created by the older editorial-driven seed are adopted in place when their editorial links to a syllabus topic; the rest keep `syllabus_topic_id = null` and the Phase 3 planner must ignore them.
- **Plans.** A signed-in user picks a target exam date and `lib/plan-generator.ts` spreads every topic evenly across the days from today to that date (informatics, then physics, then astronomy). If the window is shorter than the number of topics, topics are compressed onto the available days. Regenerating replaces the plan.
- **Quizzes and progress.** Each topic page offers a quiz. Topic status is derived from the **most recent** attempt: a score of at least 80% (`MASTERY_THRESHOLD = 0.8`) is `done`, any lower score is `in_progress`, and no attempts is `not_started`. A plan item's `completed_at` is set automatically the first time a topic reaches `done` and is not cleared by a later weaker attempt. Correct answers are never sent to the browser before submission.
- **Question bank.** There is no quiz-authoring UI; questions live in `lib/quiz-bank/` and `pnpm db:seed` copies them into `quiz_questions`, upserting on a stable `key`. Every question must carry a `difficulty` (`basic` / `intermediate` / `advanced`) and a `status` (`draft` / `reviewed`). Editors are meant to write and review the real questions; the current ones — 51 for physics (one per topic and difficulty) plus the two earlier examples — are AI-generated **drafts**, not reviewed curriculum.

The schema is in `lib/db/schema.ts` (Better Auth's `user`/`session`/`account`/`verification` tables plus `topics`, `quiz_questions`, `quiz_attempts`, `study_plans` and `plan_items`), with migrations committed in `drizzle/`. Phase 3 tables: `quiz_question_responses` (one row per answered question, written together with the attempt), `user_planner_settings` and `topic_self_ratings` (saved by `lib/planner-settings-actions.ts`; no page calls these yet); stage dates live in `lib/osn-stages.ts` (2027 dates are **projected** from 2026, not announced). `lib/mastery.ts` turns self-ratings and recorded answers into a per-topic mastery estimate; its parameters are placeholders and nothing uses it yet. Plan regeneration keeps completed plan items, and "today" is the student's calendar day (default Asia/Jakarta), not the server's.

---

## **X. Internationalisation**

Locales live in `messages/id.json` and `messages/en.json`, same keys in both, loaded via `i18n/request.ts`. Every route is locale-prefixed (`middleware.ts` + `i18n/routing.ts`) — `id` is the default locale but still gets its own `/id` prefix rather than living at the bare root. (The live deployment is therefore reached at `/en` or `/id`, not at the bare domain.) The `/keystatic` and `/api` paths are the exceptions and are never locale-prefixed. Syllabus names are stored in both locales inside the syllabus data itself, not in `messages/*.json`.

To add a locale: add it to `i18n/routing.ts`'s `locales` array, add a matching `messages/<locale>.json`, and add its names to the syllabus data (`LocalizedText` in `lib/syllabus/types.ts` falls back to Indonesian for any locale without one).

---

## **XI. Deploying**

The public site is deployed on Vercel at [project-cherenkov-app.vercel.app/en](https://project-cherenkov-app.vercel.app/en). It can be deployed with **zero required environment variables** for the archive, syllabus and materials.

1. **Push to GitHub.** This repo lives at [`github.com/project-cherenkov/project-cherenkov-app`](https://github.com/project-cherenkov/project-cherenkov-app) and is public.
2. **Import the repo in [Vercel](https://vercel.com/new).** Next.js is auto-detected; no `vercel.json` or custom build command is needed.
3. **Deploy.** No environment variables are required for the archive, i18n, or MDX pipeline.
4. **Set `NEXT_PUBLIC_SITE_URL`** to `https://project-cherenkov-app.vercel.app` (or the eventual custom domain) in Vercel so the sitemap and Open Graph metadata use the deployed origin instead of `localhost`.
5. **Optionally enable accounts and the planner** with `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, then run `pnpm db:migrate` and `pnpm db:seed` against the database ([Section IX](#ix-accounts--study-planner)).
6. **Every PR gets its own preview deploy** automatically (Vercel's default behaviour for a connected repo) — nothing extra to configure.
7. **CI runs independently of Vercel.** `.github/workflows/ci.yml` runs on Node 22: install (frozen lockfile) → `pnpm generate` → lint → typecheck → test → build, on every push and pull request to `main`. The build step includes the Blockly bundle-isolation check. No Phase 2 variables are configured in CI on purpose: the tests are unit tests that need no live database.

**Before a fully polished public launch**, read `docs/deployment-readiness.md` (keeping in mind it is a historical Phase 1 document) and resolve:

- The site is deliberately `noindex, nofollow` on every page (`app/[locale]/layout.tsx`) until the remaining placeholder content is cleared — see [Section XIII](#xiii-current-status--open-questions) for what is left.
- Whether/when to set up a real GitHub OAuth App (plus `KEYSTATIC_SECRET`) so `/keystatic` and the scene builder become reachable in production ([Section VII](#vii-editing-content-in-the-browser-keystatic)).

The public repo and public deployment are both live; the remaining blockers are content polish and the production CMS gate, not whether the app is already deployed.

---

## **XII. FAQ**

### **A. "Why does `/keystatic` 404 on Vercel until I set up GitHub OAuth?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

Local-storage Keystatic — the default, with no env vars set — has no authentication of its own; it's built to be run by whoever is already running `pnpm dev` on their own machine. Nothing stopped it from being reachable on a real deployment too, which is a problem for two separate reasons: a serverless deployment's filesystem doesn't persist writes between requests, so `/keystatic` would present a live-looking but non-functional editing UI to anyone who found the URL; and independently, the team-photo route needs its own session and `ADMIN_EMAILS` authorisation regardless of Keystatic's storage mode.

`lib/admin-guard.ts` closes the deployment exposure at the edge: on a deployed build (`NODE_ENV === "production"`, which Vercel sets for both preview and production deploys), `/keystatic`, `/api/keystatic/*`, `/api/team-photo`, and `/api/scene-builder/*` ([Section VIII](#viii-composed--programmable-scenes-the-scene-builder)) all 404 unless `KEYSTATIC_GITHUB_CLIENT_ID` **and** `KEYSTATIC_SECRET` are set. (Requiring the secret too stops a deployment from enabling GitHub-mode admin access while signing its cookies with a secret that isn't one.) The team-photo and scene-builder handlers then separately require an authenticated user whose email appears in `ADMIN_EMAILS`. Local `pnpm dev` is unaffected by the production surface gate.

</details>

### **B. "I forgot to add `<Interactive />` to my editorial — what happens?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

The visualisation still renders — right after the hook, with a small notice — rather than the editorial silently publishing with no interactive at all. Every published editorial is supposed to ship a working visualisation (see FAQ C for the one exception), so the fallback errs toward "show it somewhere" over "fail silently." Placing `<Interactive />` yourself just controls *where* it lands, which reads better than the automatic placement.

</details>

### **C. "Why can `vizConfig.discriminant` still be `"none"` if every editorial is supposed to have a visualisation?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

This is a flagged, unresolved conflict between two parts of the original build spec, not an oversight: one line states every published editorial *must* ship a working interactive visualisation; the frontmatter schema section of the same spec lists `"none"` as a legal `vizConfig.discriminant` value. `velite.config.ts` keeps `"none"` as valid at the schema level — so nothing here silently forecloses the option — but `lib/content.ts`'s `hasMissingViz()` treats it as a flagged content error the UI surfaces, not a legitimate published state. This is also the state a freshly created "New visualization" stub starts in, which is intended: it's a draft until a scene is saved into it. Which rule should actually win is still an open question; see [Section XIII](#xiii-current-status--open-questions).

</details>

### **D. "Why are `principle` and `errorType` free text instead of a fixed list?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

The taxonomy isn't finalised yet, and there isn't enough real content to know what the actual vocabulary should be — tightening these to a `z.enum([...])` in `velite.config.ts` before that's known would mean guessing at categories rather than deriving them from what actually gets written. Once there are enough real editorials to see the real vocabulary, `velite.config.ts` is the only file that needs to change.

</details>

### **E. "Is the site ready to be indexed?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

The code is ready; the switch is still off. Every page ships `noindex, nofollow` until the environment variable `NEXT_PUBLIC_ALLOW_INDEXING` is set to `1` (it replaces the old hard-coded `robots: { index: false, follow: false }` in `app/[locale]/layout.tsx`, so going live no longer needs a code change). Even with it on, account/login/signup/planner pages stay `noindex`, and so does any editorial whose author is still the `PLACEHOLDER …` value or that is tagged `fixture` — those are also left out of the sitemap and `/llms.txt`. At the time of writing every editorial still has the placeholder author, so the archive itself would remain `noindex` after flipping the switch until real author names are entered. `docs/seo-and-accessibility.md` has the full pre-launch checklist.

</details>

### **F. "Why do I see 'GitHub authorization required...' in the scene builder even though I'm already logged into `/keystatic`?"**

<details>
<summary><b>View Explanation (Click to expand)</b></summary>

Because Keystatic's own login and the scene builder's own GitHub access are two separate OAuth handshakes by design ([Section VIII](#viii-composed--programmable-scenes-the-scene-builder)) — being logged into `/keystatic` doesn't also authorise the scene builder. Follow the link the error itself shows ("Authorize with GitHub"), or see [`docs/scene-builder-github-auth.md`](docs/scene-builder-github-auth.md) for the full walkthrough and a troubleshooting checklist if it still doesn't go through. The authorisation is also time-limited (1 hour), so seeing this again later isn't a regression.

</details>

---

## **XIII. Current Status & Open Questions**

- The repo is public at [`github.com/project-cherenkov/project-cherenkov-app`](https://github.com/project-cherenkov/project-cherenkov-app), and the live deployment is at [`project-cherenkov-app.vercel.app/en`](https://project-cherenkov-app.vercel.app/en). The default locale is served under a locale prefix, not at the bare site root.
- **Built:** the editorial archive with five visualisation engines; the syllabus and materials sections; Keystatic editing; the scene builder (composed and programmable modes, with save and "New visualization"); accounts, the study planner and quizzes.
- **Not built:** Phase 3 adaptive scheduling (design only), a quiz-authoring UI, and a Content-Security-Policy.
- **Content is thin.** There are three real editorials plus one implementation fixture, and one material (`binary-search`). Of the syllabus, only informatics has a starter material; physics and astronomy have none yet.
- **About page.** `content/team/index.json` has one real member plus a dummy entry named "placeholder" ("the holder of place") that currently renders on the page. The project contact email is set, so the `[PLACEHOLDER — contact inquiries TBD]` fallback in `messages/*.json` no longer shows. The site stays `noindex`/`nofollow`; the comment in `app/[locale]/layout.tsx` ties that to finishing placeholder copy, so the dummy team entry is the thing to resolve before flipping it.
- **Physics syllabus source.** `lib/syllabus/data/physics.ts` is labelled as coming from the official OSN guidebook (confirmed by the project owner), but the exact title, edition and URL are not recorded yet — add `edition`/`url` to its `source` once known.
- Keystatic and the scene builder stay gated behind GitHub OAuth in deployed builds, and remain unavailable unless `KEYSTATIC_GITHUB_CLIENT_ID` and `KEYSTATIC_SECRET` are configured.
- The `vizConfig.discriminant: "none"` schema-vs-spec conflict (FAQ C) and the free-text `principle`/`errorType` taxonomy (FAQ D) are both still open.

This is the current state of the repo: public codebase, public deployment, the archive/syllabus/materials/planner features built, a few About-page and syllabus fields still being written, and production admin access still behind the GitHub OAuth gate.
