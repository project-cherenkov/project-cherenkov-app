# SEO, accessibility and the `/docs` pages

Engineering notes for the pass that added the documentation pages and
improved search-engine and accessibility behaviour. Written for whoever
touches this next (human or agent); the user-facing explanation of the docs
is README Section VI-b.

## 1. Why docs live inside this app

Docs are `content/docs/<locale>/*.mdx`, a third Velite collection, rendered by
this same Next.js app at `/[locale]/docs`. A separate docs site was considered
and rejected for now:

- docs here need the real thing — same i18n, theme, design tokens, KaTeX and
  (later) the actual visualization components — and a second site would
  duplicate that whole pipeline;
- a sub-path (`/docs`) keeps search authority on one domain, where a
  subdomain starts from zero;
- one repo, one deploy, one set of CI checks for a team this size.

It is low-regret: the content is plain MDX with frontmatter, so it can be
lifted into a standalone docs framework later if versioned docs, an API
reference or a different team ever justify it.

## 2. Indexing: the switch and the launch checklist

Nothing is indexable until `NEXT_PUBLIC_ALLOW_INDEXING=1` (`lib/seo.ts`,
`isIndexingEnabled`). This replaces the old hard-coded `noindex`. These stay
`noindex` **regardless** of the switch:

- login, signup, account, planner and planner topic pages;
- editorials tagged `fixture` or whose author starts with `PLACEHOLDER`
  (`isIndexableEditorial`) — also omitted from the sitemap and `/llms.txt`;
- docs shown under `/id` that are really the English fallback (they
  canonicalise to the English URL).

**Before setting the switch:**

1. `NEXT_PUBLIC_SITE_URL` is the real origin (it falls back to localhost, and
   every canonical, hreflang, sitemap and Open Graph URL is built from it).
2. Real author names replace `PLACEHOLDER Author Name` in the editorials —
   otherwise the archive, the most valuable content, stays `noindex`.
3. Decide what to do with `programmable-scene-fixture.mdx`. It is a test
   fixture that is public in the archive; it is kept out of search, but it is
   still visible to visitors.
4. Decide the AI-crawler policy (below).
5. Submit `https://<domain>/sitemap.xml` in Search Console and check that
   `/id` and `/en` pages show the right language pairing.

## 3. What each page declares

| Page | Title | Canonical + hreflang | Structured data | Index |
| --- | --- | --- | --- | --- |
| Home | `site.homeTitle` (absolute) | yes | Organization, WebSite | switch |
| Archive | `archive.title` | always the unfiltered URL | — | switch |
| Editorial | its title | yes | Article, BreadcrumbList | switch + author/fixture guard |
| Material | its title | yes | BreadcrumbList | switch |
| Syllabus, subject | translated names | yes | — | switch |
| About | `about.title` | yes | — | switch |
| Docs | its title | only locales it exists in | TechArticle, BreadcrumbList | switch; fallback = noindex |
| Login/signup/account/planner | translated | yes | — | never |

Every page also gets Open Graph + Twitter tags and a 1200×630 social card
(`app/[locale]/opengraph-image.tsx`, plus a per-editorial one). The cards use
Next's built-in font only; using the project's typefaces needs the font files
bundled — a typography decision, not made here.

`robots.txt` additionally disallows `/keystatic`, `/api` and the account-only
paths. A page blocked there can never have its `noindex` read; don't add pages
to that list that you want *removed* from search results.

## 4. Accessibility changes

- **`<html lang>` follows the URL.** The old single root layout hard-coded
  `lang="en"`, so every Indonesian page (the default locale) was announced in
  English (WCAG 3.1.1). There is now no `app/layout.tsx`: `app/[locale]/layout.tsx`
  and `app/keystatic/layout.tsx` are each a root layout.
- Skip link + `<main id="main-content">`; labelled nav landmarks; `aria-current`
  on the current page and language; language links carry `lang`/`hreflang` and
  autonym labels; the menu button is named by its visible text and exposes
  `aria-expanded`; Escape closes the drawer and returns focus.
- **Sliders were all announced as "value".** The thumb hard-coded
  `aria-label="value"`; callers' labels are now passed through. Canvases have
  `role="img"` with a state-aware label; the loading placeholder is a status.
- The playback step label no longer announces every frame while playing.
- **Contrast.** The pastel blue (`#8AD7FF`) is 1.6:1 on white; it is now used
  only on dark surfaces, with `cherenkov-blue-800` (6.1:1) for text on light.
  `blue-700` (4.0:1) is fine for borders but not for small text. Focus ring is
  `--ring` (4.0:1 light, 9.5:1 dark). Form borders and `slate-400` text on
  white were raised. The playback bar no longer stays white in dark mode.
- Targets: icon buttons 44px, header controls 40px+.
- Autofill hints (`autocomplete`) on login/signup (WCAG 1.3.5).
- Scroll padding under the sticky header so focused/anchored content is not
  hidden (WCAG 2.4.11).

### Verified vs. not verified

Verified in CI-equivalent runs: typecheck, lint, 700 unit tests, production
build, and an axe-core pass over built pages (structural rules only — axe
cannot evaluate colour contrast without a real browser).

**Not verified, needs a human with a browser:** colour contrast in context
(ratios above are computed from the tokens), real screen-reader testing (NVDA
or VoiceOver) of a visualization, 320–400px header layout after the larger
touch targets, and keyboard use of the Blockly scene builder (admin-only,
not touched).

## 5. Known gaps and open decisions

- **Docs link in the header.** Not added: the bookmark nav is already close to
  its width budget between 857px and ~1000px, and a sixth bookmark would
  overflow. Docs are linked from the footer and the home page. Adding one means
  raising the `min-[857px]` breakpoint or shrinking the bookmarks.
- The header's **"Edit" bookmark** links every visitor to `/keystatic`
  (a 404 or a login for most). Consider showing it to editors only.
- **Indonesian docs** do not exist yet; the English text is shown with a
  notice. Add `content/docs/id/<same-name>.mdx`.
- Canvas descriptions are generic for composed/programmable scenes (the
  scene's step note is the real description); an authored `description` field
  per visualization would be better.
- **AI crawlers.** `llms.txt` helps assistants cite the site accurately but
  is not access control. Whether AI companies may train on the content is a
  licensing decision (the repo is MIT; the content's licence isn't stated) to
  make in `app/robots.ts`.
- The `/keystatic` link, the `new Function()` MDX evaluation and the lack of
  a Content-Security-Policy are unchanged (see `deployment-readiness.md`).
