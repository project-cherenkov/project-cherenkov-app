# docs/ index

This folder holds developer-facing notes for people and agents working on the repository. It is not the in-app documentation: that lives in `content/docs/<locale>/*.mdx` and is served at `/docs`. It is also not the root `README.md`, which covers setup and how the site works.

Code wins. If a file here disagrees with `app/globals.css`, `tailwind.config.ts`, `lib/`, `messages/` or any other code, the code is right and the file should be corrected.

## How to use it

A newcomer should read [project/overview.md](project/overview.md), then [project/product-identity.md](project/product-identity.md), then the folder that matches the task:

| Folder | Read it when you are |
| --- | --- |
| `project/` | learning what the project is, who it is for and why it looks and sounds the way it does |
| `agents/` | using or maintaining the writer and revision agent workflows |
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
| `project/product-identity.md` | Name, definition, promise and credo, content identity, commitments, subject boundary, audience, language, voice. | current |
| `agents/README.md` | Which agent instructions to use, their authority, snapshot limitations and maintenance rules. | current |
| `agents/CHERENKOV-WRITER-AGENT-INSTRUCTIONS-v2.1-2026-11-21.md` | Current standards and workflow for creating editorials and materials. Includes dated syllabus and content-registry snapshots. | current |
| `agents/CHERENKOV-WRITER-AGENT-INSTRUCTIONS-v2.0-2026-11-17.md` | Previous version of the writing standard. | historical |
| `agents/CHERENKOV-REVISION-AGENT-INSTRUCTIONS-v1.1-2026-11-21.md` | Current diagnosis and revision workflow for existing editorials and materials. Section 4 contains dated starting notes, not current diagnoses. | current |
| `agents/CHERENKOV-REVISION-AGENT-INSTRUCTIONS-v1.0-2026-11-17.md` | Previous version of the revision standard. | historical |
| `project/inspiration-and-philosophy.md` | The homages and the open-knowledge stance, in the owner's words. Source for the in-app `/docs/philosophy` page. | current |
| `design/visual-identity.md` | The mark, the wordmark and the type pairing. | current |
| `design/colour.md` | Palette, tokens, roles, proportion, contrast, and the colour role audit. | current |
| `design/eyebrows.md` | The file-name eyebrows above page titles: the rule and the registry. | current |
| `design/neutrino-mascot.md` | How the Neutrino mascot works now, and the moods planned next. | current |
| `design/visualization-interactions.md` | Review of the visualization engines against Brilliant, with prioritised recommendations. | review |
| `design/home-visualization-picker.md` | The home hero's "Your picks": behaviour, storage, accessibility, and measured engine heights. | current |
| `product/syllabus-sources.md` | Where the topic lists in `lib/syllabus/data/*.ts` come from, and how far each was checked. | current |
| `product/syllabus-expansion.md` | Plan for labelling national (OSN) and international (IOI, IPhO, IOAA) syllabus topics. Design only; not built. | current |
| `product/phase-3-planner.md` | The OSN study planner as built. | current |
| `product/planner-context-transfer.md` | Research and reasoning behind the planner's design. | current |
| `engineering/cherenkov-env-vars-guide.md` | Every environment variable, what it unlocks and how to obtain it. | current |
| `engineering/scene-builder-github-auth.md` | Walkthrough for the scene builder's GitHub authorisation step. | current |
| `engineering/email-and-domain.md` | Sending identity, the email checklist, rollout order for editor verification, preview deployments, database notes. | current |
| `engineering/account-email-flows.md` | How verification, password reset, change password, account deletion, linking and rate limits work; rotating the Resend key. | current |
| `engineering/security-headers.md` | The report-only Content-Security-Policy and `security.txt`. | current |
| `engineering/seo-and-accessibility.md` | How indexing is switched on, what pages declare to search engines, accessibility decisions. | current |
| `engineering/quiz-authoring.md` | Writing, reviewing and syncing quiz questions: the Keystatic collections, the question ID, review rules, the git-to-database sync and the archive switch. | current |
| `engineering/internationalization.md` | How the UI message files are laid out, loaded and checked; adding a string, a file or a locale. | current |
| `reviews/audit-2026-10-31.md` | Design, accessibility, SEO and legal audit of 31 October 2026. | review |
| `reviews/design-review-2026-10.md` | UI design review of October 2026: what changed, open findings, browser checklist. The palette moved to `design/colour.md`. | review |
| `history/deployment-readiness.md` | The Phase 1 deployment-hardening write-up. | historical |
| `history/phase-2-architecture.md` | The original Phase 2 design sketch. | historical |
| `history/phase-3-architecture.md` | The original Phase 3 design sketch. | historical |

## Conventions

- Code, schemas and tests determine application behaviour; project docs record product decisions; agent instructions define workflows within those constraints.
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
| Name, positioning and content identity | `project/product-identity.md` |
| Agent writing and revision workflows | `agents/README.md` and the versioned instructions it indexes |
| Colour | `design/colour.md` |
| Mascot | `design/neutrino-mascot.md` |
| Mark, wordmark and type | `design/visual-identity.md` |
| Syllabus sources | `product/syllabus-sources.md` |
| Planner | `product/phase-3-planner.md` |
| Environment variables | `engineering/cherenkov-env-vars-guide.md` |
| Email sending, verification and the editor rollout | `engineering/email-and-domain.md` |
| Account email flows | `engineering/account-email-flows.md` |
| Security headers | `engineering/security-headers.md` |
| SEO and accessibility | `engineering/seo-and-accessibility.md` |
| UI message files and locales | `engineering/internationalization.md` |
