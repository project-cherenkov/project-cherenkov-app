# Product identity

> Written 2026-11-08. Status: current. This file decides name and positioning. Colour is decided in [colour](../design/colour.md); the mark, wordmark and type in [visual identity](../design/visual-identity.md). Code wins if it disagrees with this file.

## Definition

One sentence, for use wherever a definition is needed:

> Project Cherenkov is an archive of olympiad ideas made visible: each one a full proof with an interactive visualization, filed by the mistake it corrects, for informatics, physics and astronomy.

The broader description is in [overview](overview.md).

## Name

The full public name is **Project Cherenkov**. **Cherenkov** is acceptable shorthand. In the interface the header wordmark stays lowercase, **cherenkov**, set in Space Grotesk. The page title and metadata use the full name.

Earlier versions of the visual identity file called "Project Cherenkov" internal only. That is reversed: the full name is already used on the project's social accounts, so it is the public name.

## Promise and credo

**Tagline (the promise): "From Curiosity to Visualization".** Plain language, outward-facing: it says what the project does for the reader. It is not translated, because the C...V origin only works in English: C(uriosity) and V(isualization) are the first and last letters of Cherenkov. "Curiosity" does not come from the Latin motto.

**Motto (the credo): "Cognitio · Humanitas · Exploratio".** Latin, inward-facing: it says what the project believes and is made of.

- Cognitio is inquiry, the curiosity end.
- Humanitas is the learner in the middle, and the reason any of it matters.
- Exploratio is the visualization end, where exploration becomes visible.

The motto is identical in both interface languages. The middle dot is U+00B7; keep the file UTF-8. Its abbreviation is not a public label: do not use "CHE" in the interface, metadata or copy.

## Commitments

1. **Visible.** No editorial without something to manipulate.
2. **Error-first.** Every piece names a specific mistake it corrects.
3. **Rigorous and honest about limits.** A full proof, a stated scope, and sources.

## Subject boundary

The subjects are informatics, physics and astronomy. The test for a new topic: is it a hidden mechanism in olympiad physics, astronomy or informatics that becomes clear once you can see it? If not, it is outside the project. The identity (mark, Neutrino, colours, the Cherenkov concept) is built around these three, which is why biology and chemistry are excluded.

## Audience and language

There are two layers.

- **Content layer.** English and universal. Editorials and materials are written in English and are not specific to one country's olympiad.
- **Pathway layer.** Indonesia-first: the OSN syllabus, the OSN planner with its stage dates, and the Indonesian interface.

Do not claim an international syllabus or planner until they are built. The plan is in [syllabus expansion](../product/syllabus-expansion.md).

## Voice

The voice borrows from file labels (`readme.md`, `about.md`, `requirements.txt`): plain, precise, no hype. State what a thing is and what it does. Do not use superlatives or promotional phrasing. The code-label eyebrows on the site are part of this voice; see the note about using them as the only heading style in [the design review](../reviews/design-review-2026-10.md).

## Where each element appears

| Element | Where it appears |
| --- | --- |
| Tagline | Home hero heading (`home.heroTitle`), footer (`footer.tagline`) |
| Motto | Footer, under the tagline (`footer.motto`) |
| Descriptive sentence | Site tagline and meta description (`site.tagline`) |
| Wordmark | Site header, lowercase "cherenkov" |
| Mark | Site header and favicon (`components/site/brand-mark.tsx`) |
| Colours | Tokens in `app/globals.css` and `tailwind.config.ts`; rules in [colour](../design/colour.md) |
| Companion | Neutrino launcher and panel (`components/study/*`); see [Neutrino mascot](../design/neutrino-mascot.md) |

## Decision status

Confirmed by the owner: the subject boundary, the audience and language policy, the tagline, the motto, the palette and its homages, the scope of the About page, keeping the placeholder team entry, the mascot rule change, and the plan to expand the syllabus.

Proposed and applied, awaiting the owner's confirmation: "Project Cherenkov" as the single public name in titles and metadata, the colour roles in [colour](../design/colour.md), the Neutrino "flash" direction, and holding broad promotion until each subject has roughly ten editorials.

Open: the domain name (see below), and whether the tagline gets an Indonesian gloss.

## Do not

- Do not add subjects outside the boundary.
- Do not claim an international syllabus, an international planner or editorial authorship credentials that the repository cannot support.
- Do not use "CHE" as a public label.
- Do not use the free `vercel.app` subdomain as the public face once a domain exists.
- Do not buy or register a domain on the project's behalf without the owner. The recommendation is a `.org` or `.com` on "projectcherenkov", with an optional `.id` redirecting to it; avoid cheap novelty TLDs.

## See also

[Overview](overview.md), [inspiration and philosophy](inspiration-and-philosophy.md), [colour](../design/colour.md), [visual identity](../design/visual-identity.md).
