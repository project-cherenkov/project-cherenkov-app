# docs/ index

This folder holds developer-facing notes for people and agents working on the repository. It is not the in-app documentation: that lives in `content/docs/<locale>/*.mdx` and is served at `/docs`. It is also not the root `README.md`, which covers setup and how the site works.

Code wins. If a file here disagrees with `app/globals.css`, `tailwind.config.ts`, `lib/`, `messages/*.json` or any other code, the code is right and the file should be corrected.

## How to use it

A newcomer should read [project/overview.md](project/overview.md), then [project/product-identity.md](project/product-identity.md), then the folder that matches the task:

| Folder | Read it when you are |
| --- | --- |
| `project/` | learning what the project is, who it is for and why it looks and sounds the way it does |
| `design/` | changing the interface, colour, mark, mascot or visualizations |
| `product/` | working on the syllabus, the planner or their sources |
| `engineering/` | configuring environment variables, authorisation, SEO or accessibility |
| `reviews/` | looking for dated review findings and what was done about them |
| `history/` | looking for early design sketches, kept for context only |

Files are sorted by what a reader is trying to do, with one purpose per file.

## Every file

Status: `current` (kept up to date), `review` (dated findings; not edited afterwards) or `historical` (kept as written; superseded).

| Path | Purpose | Status |
| --- | --- | --- |
| `README.md` | This index: what the folder is, every file, conventions, source of truth by topic. | current |
| `project/overview.md` | The broad definition of Project Cherenkov: what it is, for whom, its sections and boundaries. | current |
| `project/product-identity.md` | Name, definition, promise and credo, commitments, subject boundary, audience, language, voice. | current |
| `project/inspiration-and-philosophy.md` | The homages and the open-knowledge stance, in the owner's words. Source for the in-app `/docs/philosophy` page. | current |
| `design/visual-identity.md` | The mark, the wordmark and the type pairing. | current |
| `design/colour.md` | Palette, tokens, roles, proportion, contrast, and the colour role audit. | current |
| `design/neutrino-mascot.md` | How the Neutrino mascot works now, and the moods planned next. | current |
| `design/visualization-interactions.md` | Review of the visualization engines against Brilliant, with prioritised recommendations. | review |
| `product/syllabus-sources.md` | Where the topic lists in `lib/syllabus/data/*.ts` come from, and how far each was checked. | current |
| `product/syllabus-expansion.md` | Plan for labelling national (OSN) and international (IOI, IPhO, IOAA) syllabus topics. Design only; not built. | current |
| `product/phase-3-planner.md` | The OSN study planner as built. | current |
| `product/planner-context-transfer.md` | Research and reasoning behind the planner's design. | current |
| `engineering/cherenkov-env-vars-guide.md` | Every environment variable, what it unlocks and how to obtain it. | current |
| `engineering/scene-builder-github-auth.md` | Walkthrough for the scene builder's GitHub authorisation step. | current |
| `engineering/seo-and-accessibility.md` | How indexing is switched on, what pages declare to search engines, accessibility decisions. | current |
| `reviews/audit-2026-10-31.md` | Design, accessibility, SEO and legal audit of 31 October 2026. | review |
| `reviews/design-review-2026-10.md` | UI design review of October 2026: what changed, open findings, browser checklist. The palette moved to `design/colour.md`. | review |
| `history/deployment-readiness.md` | The Phase 1 deployment-hardening write-up. | historical |
| `history/phase-2-architecture.md` | The original Phase 2 design sketch. | historical |
| `history/phase-3-architecture.md` | The original Phase 3 design sketch. | historical |

## Conventions

- Code wins over docs.
- A doc says when it was written. Dated findings stay dated.
- Historical and review files are kept, not edited. Their findings are not rewritten; a short pointer or annotation at the top is allowed.
- When a decision changes, update the source-of-truth file for that topic (table below) and leave a pointer in the old place.
- Use plain ASCII punctuation in Markdown (straight quotes and hyphens). The one expected exception is the middle dot in the motto, "Cognitio · Humanitas · Exploratio", which must stay UTF-8.
- To add a doc: put it in the folder that matches what the reader is trying to do, add a row to the table above, and cross-link related docs.
- When you move a file, use `git mv` so history follows, and add a line under its title: `> Moved from docs/<old-name>.md on <date>.`

## Source of truth by topic

| Topic | The file that decides it |
| --- | --- |
| Name and positioning | `project/product-identity.md` |
| Colour | `design/colour.md` |
| Mascot | `design/neutrino-mascot.md` |
| Mark, wordmark and type | `design/visual-identity.md` |
| Syllabus sources | `product/syllabus-sources.md` |
| Planner | `product/phase-3-planner.md` |
| Environment variables | `engineering/cherenkov-env-vars-guide.md` |
| SEO and accessibility | `engineering/seo-and-accessibility.md` |
