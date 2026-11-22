# Eyebrows

An eyebrow is the small file name above a page title (`readme.md`, `docs.zip`). It is a quiet part of the site's voice (see `docs/project/product-identity.md`). This file is the registry and the rule for adding one. The code is the source of truth for the strings: they live in `messages/<locale>/*.json` under an `eyebrow` key, and `ErrorState` takes an `eyebrow` prop.

## The rule

**An eyebrow must mean what its file type means.** No extension is decoration.

| Extension | Meaning | Use for |
| --- | --- | --- |
| `.md` | A prose document written in Markdown. | About, readme, written references. |
| `.log` | A dated, chronological record that grows over time. | Entries published in sequence. |
| `.txt` | Plain text: a simple list or notes. | Lists. |
| `.zip` | A bundle of several files. | Multi-page collections. |
| `.toc` | A table of contents. | A contents map. |
| `.json`, `.yaml` | Structured data. | Avoid: these are not documents. |

Do not give an eyebrow to a page whose title already says the same thing (Account, Progress, Review, Timer and the planner pages have none). An eyebrow is `aria-hidden`: it is a label, not a link, and never carries information that is not in the page.

## Registry

| Page | Eyebrow | Why |
| --- | --- | --- |
| Home | `readme.md` | A README is a project's introductory document. |
| About | `about.md` | A prose document about the project. |
| `/archive` (editorials) | `editorials.log` | Each editorial is a dated entry. Revisit if `/archive` ever lists more than editorials. |
| Materials | `reference.md` | Materials are concise written references. |
| Syllabus | `syllabus.toc` | A syllabus is a contents map of the territory. (`syllabus.txt` is the alternative if `.toc` is too obscure.) |
| Docs | `docs.zip` | The docs are a bundle of several pages. |
| Updates | `changelog.md` | The conventional file for chronological change notes. |
| Not found | `404.md` | The Jekyll and GitHub Pages convention for a custom not-found page. |
| Runtime error | `error.log` | A record of an error. |

## Type

Eyebrows use the pixel face (`.label-pixel`, 14px and up), not `.label-code`, which stays 12px mono for chips, breadcrumbs and counts. See `docs/design/visual-identity.md` for where the pixel face is allowed.
