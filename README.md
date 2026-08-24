# Cherenkov

An Indonesian OSN (olympiad) editorial archive — informatics, physics, and
astronomy proofs, each paired with a working interactive visualization.
Indexed by **principle** and **error type**, not by chapter.

## Stack

Next.js (App Router) + TypeScript · Tailwind CSS + shadcn/ui-style
primitives · MDX content compiled with [Velite](https://velite.js.org) ·
KaTeX (via `remark-math`/`rehype-katex`, compiled to static markup at
build time) · D3 (scales only) + Canvas 2D for the visualizations ·
`next-intl` for i18n (`id`/`en`) · pnpm.

## Getting started

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev
```

Velite watches `content/` and regenerates `.velite/` automatically while
`pnpm dev` is running (it starts both `next dev` and `velite dev`
together) — you don't need to run it separately. `pnpm build` runs
Velite once, then Next.

If your editor complains that `#content` can't be found, or a fresh clone
fails to type-check, run `pnpm generate` once to produce `.velite/`
directly.

Core Phase 1 needs **no environment variables** — there's no database or
auth yet, content is just git-committed MDX. Two optional additions do use
env vars; see `.env.example` for the full list and defaults:

- **Keystatic** (`/keystatic`, in-site editing): with no env vars set, it
  runs in local-storage mode against your working copy — nothing extra to
  configure. `KEYSTATIC_GITHUB_CLIENT_ID`/`_SECRET`/`_SECRET` and
  `KEYSTATIC_GITHUB_REPO` switch it to GitHub-storage mode for production.
- **Vercel Blob** (team-photo upload, `app/api/team-photo/route.ts`): needs
  `BLOB_READ_WRITE_TOKEN` from a Vercel Blob store. Without it, the upload
  route returns a clear 503 rather than failing at Blob's own API.

See `.env.example` for what Phase 2 will eventually need.

## Project structure

```
app/[locale]/                    routes (everything is locale-prefixed)
  archive/[subject]/[slug]/      one editorial's page
  login/ signup/ planner/        Phase 2 placeholders ("coming soon")
components/
  ui/                            hand-rolled shadcn/ui-style primitives
  site/                          header, footer, cards, filters
  viz/                           the three visualization engines
content/editorials/<subject>/    the actual archive content (MDX)
lib/content.ts                   all querying/filtering of editorials goes
                                  through here — pages never import
                                  Velite's #content directly
messages/{id,en}.json            UI strings
docs/phase-2-architecture.md     Phase 2 plan (not implemented)
```

## Writing an editorial

Add a `.mdx` file under `content/editorials/<subject>/`. Frontmatter:

```yaml
---
title: "A clear, specific title"
subject: informatics # informatics | physics | astronomy
hook: "One sentence that makes someone want to read on."
tags: ["short", "lowercase", "tags"]
principle: "the-general-idea-this-teaches" # free text, see note below
errorType: "the-mistake-this-corrects" # free text, optional
vizEngine: graph-array-stepper # graph-array-stepper | trajectory-sandbox | orbital-sandbox
vizConfig: { ... } # shape depends on vizEngine — see below
publishedAt: "2026-08-01"
author: "Your name"
---
```

Body is regular Markdown/MDX. Use `$...$` for inline math and `$$...$$`
for display math — it's compiled to static KaTeX HTML at build time, so
there's no math-rendering JS shipped to the reader.

Place `<Interactive />` on its own line wherever the visualization should
sit — typically between "the idea" and "the full proof." **If you forget
it, the site still shows the visualization** (right after the hook,
with a small notice) rather than silently publishing an editorial with
no interactive — but placing it yourself gives you control over where it
lands, which reads better.

Three real, complete examples to copy from:
- `content/editorials/informatics/binary-search-on-answer.mdx` (graph-array-stepper)
- `content/editorials/physics/projectile-range-symmetry.mdx` (trajectory-sandbox)
- `content/editorials/astronomy/eccentric-transit-duration.mdx` (orbital-sandbox)

### `vizConfig` by engine

**`graph-array-stepper`** — an array with precomputed steps (pointers,
highlighted cells, a one-line note per step). Frontmatter is static data,
not code, so there's no literal "step function" — you write out each
step's state directly:

```yaml
vizConfig:
  array: [2, 4, 6, 8, 10]
  steps:
    - pointers: { lo: 0, hi: 4, mid: 2 }
      highlight: [2]
      note: "What's happening at this step."
```

**`trajectory-sandbox`** — adjustable initial speed/angle, animated on a
canvas. `physicsType` selects a named physics function from a small
registry in `components/viz/trajectory-sandbox/index.tsx` (same reason as
above — frontmatter can't hold a real function). Currently only
`"projectile"` exists; adding a new scenario means adding one entry to
that registry.

```yaml
vizConfig:
  physicsType: projectile
  gravity: 9.8
  initial: { speed: 20, angleDeg: 45 }
  speedRange: [5, 40] # optional slider bounds
  angleRange: [5, 85]
```

**`orbital-sandbox`** — eccentricity + mass ratio sliders driving a
Kepler-accurate orbit and a simplified, clearly-labeled-as-schematic
transit light curve (periapsis-aligned transit; see the astronomy example
for the derivation and its stated limits).

```yaml
vizConfig:
  eccentricity: 0.3
  semiMajorAxisPx: 130
  periodSeconds: 6
  massRatio: 0.05 # optional, default 0.05
  transitDepth: 0.015 # optional, default 0.01
```

## i18n

Locales live in `messages/id.json` and `messages/en.json`, same keys in
both. To add a locale: add it to `i18n/routing.ts`'s `locales` array and
add a matching `messages/<locale>.json`.

## Deploying

Built for Vercel. Push to GitHub, import the repo in Vercel, no
environment variables needed for Phase 1. Every PR gets a preview deploy.

## Deployment readiness

The public archive is deployable as-is (see "Deploying" above — no env
vars required). Before a real public launch, see
`docs/deployment-readiness.md` for what's been hardened (the CMS admin
surface was unauthenticated by default; now gated), what's still
placeholder content, and what needs a real decision rather than a guess.

## Open questions (flagged, not guessed)

These were left as clearly-marked placeholders rather than decided
unilaterally — search the codebase for `PLACEHOLDER` to find every
instance:

- **Typography.** No typeface has been chosen. `tailwind.config.ts`
  currently falls back to the system font stack so nothing renders
  broken — swap `fontFamily.sans` there once it's decided.
- **`principle` / `errorType` taxonomy.** Left as free strings in
  `velite.config.ts` on purpose. Once there are enough real editorials to
  see the actual vocabulary, tighten them to a fixed `enum`.
- **Repo visibility.** Now points at the real repo
  (`github.com/project-cherenkov/project-cherenkov-app`), but it's
  private — the About page's "built in the open" copy and the header's
  public GitHub link both currently promise access a public visitor
  won't have. See `docs/deployment-readiness.md` §5 item 2.
- **Author names.** All three example editorials use
  `"PLACEHOLDER Author Name"`.
- **Hero/footer copy.** `messages/*.json` has several
  `[PLACEHOLDER — ... ]` strings for copy that wasn't provided (hero
  headline, taglines, about-page philosophy and team bios).
- **OAuth provider(s) for Phase 2** — see
  `docs/phase-2-architecture.md`.
- **Spec conflict, flagged not resolved:** the build spec states every
  published editorial *must* ship a working interactive visualization,
  but its own frontmatter schema allows `vizEngine: none`. This repo
  keeps `"none"` as a valid schema value (so nothing here silently
  forecloses the option) but treats it as a flagged content error in the
  UI rather than a legitimate state — see the comment in
  `velite.config.ts` and `components/viz/viz-engine.tsx`. Confirm which
  rule should actually win.
