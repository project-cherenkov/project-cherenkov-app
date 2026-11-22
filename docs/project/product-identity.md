# Product identity

> Written 2026-11-08. Status: current. This file decides name and positioning. Colour is decided in [colour](../design/colour.md); the mark, wordmark and type in [visual identity](../design/visual-identity.md). Code wins if it disagrees with this file.

## Definition

One sentence, for use wherever a definition is needed:

> Project Cherenkov is an open learning archive for olympiad informatics, physics and astronomy: its syllabus maps the territory, interactive materials establish concepts, and interactive editorials investigate ideas through specific questions and situations.

The broader description is in [overview](overview.md).

## Name

The full public name is **Project Cherenkov**. **Cherenkov** is acceptable shorthand. In the interface the header wordmark stays lowercase, **cherenkov**, set in Space Grotesk. The page title and metadata use the full name.

Earlier versions of the visual identity file called "Project Cherenkov" internal only. That is reversed: the full name is already used on the project's social accounts, so it is the public name.

## Promise and credo

**Tagline (the promise): "From Curiosity to Vision".** Outward-facing: it describes the intellectual outcome Cherenkov wants to support, not a particular interface feature. The C...V structure still echoes the first and last letters of Cherenkov: C(uriosity) and V(ision). "Curiosity" does not come from the Latin motto.

**Motto (the credo): "Cognitio · Humanitas · Exploratio".** Latin, inward-facing: it says what the project believes and is made of.

- Cognitio is inquiry, the curiosity end.
- Humanitas is the learner in the middle, and the reason any of it matters.
- Exploratio is the exploratory process: examining, testing and developing an understanding of ideas. Visualization is one of its defining instruments, not its final goal.

The motto is identical in both interface languages. The middle dot is U+00B7; keep the file UTF-8. Its abbreviation is not a public label: do not use "CHE" in the interface, metadata or copy.

## Content identity

Cherenkov has three complementary content layers. They serve different learning purposes and are connected by the syllabus, but they are not a mandatory sequence: a topic may have a material without an editorial, or an editorial without a corresponding material.

- **Syllabus - scope.** The syllabus describes the territory: subjects, topics and subtopics, with their provenance and the syllabuses that include them. It helps readers see what is in scope and find related learning content.
- **Materials - foundation.** A material is an unsigned, self-contained explanation of the essential concepts within a syllabus topic or subtopic. It covers the relevant definitions, relationships, key results, derivations, procedures and common traps. It should be complete enough to establish the topic's conceptual foundations, but need not become an exhaustive textbook chapter. Every published material includes a meaningful interactive visualization that clarifies the concept.
- **Editorials - exploration.** An editorial independently investigates a particular question, case, phenomenon or problem through a focused line of reasoning. It makes the central idea explorable through an interactive visualization and supports its argument with a complete proof, derivation or other appropriate reasoning. It may link to a related material for broader foundations, but does not require the reader to study that material first. It is not required to begin from, or correct, a student mistake.

Materials and editorials are complementary, not interchangeable. A material establishes the conceptual framework; an editorial explores an idea at work in a concrete situation. An editorial should add an insight or investigation rather than merely repeat the corresponding material.

Editorials are identified by a `principle`: the general idea they teach. An `errorType` may also be supplied when a specific, meaningful misconception is being addressed. It is optional; it is not a requirement that every editorial invent or name an error. The syllabus topic link is also optional for an editorial. Materials instead link directly to a syllabus topic.

## Commitments

1. **Visual understanding.** Every published material and editorial includes a working, meaningful interactive visualization. In a material, it clarifies a concept or relationship; in an editorial, it supports a focused investigation. The explanation leads and remains complete in its own right. Visual novelty, animation and complexity never compensate for weak reasoning.
2. **Principle-led.** Editorials are organised around the ideas they investigate. Name a specific error type when it is genuinely relevant, not as a prerequisite.
3. **Rigorous and honest about limits.** State assumptions and scope; support claims with complete reasoning and appropriate sources; distinguish established results from approximations and limitations.

## Subject boundary

The subjects are informatics, physics and astronomy. The test for a new topic: is it a hidden mechanism in olympiad physics, astronomy or informatics that becomes clear once you can see it? If not, it is outside the project. The identity (mark, Neutrino, colours, the Cherenkov concept) is built around these three, which is why biology and chemistry are excluded.

## Audience and language

There are two layers.

- **Content layer.** English and universal. Editorials and materials are written in English and are not specific to one country's olympiad.
- **Pathway layer.** Indonesia-first: the OSN syllabus, the OSN planner with its stage dates, and the Indonesian interface.

The syllabus pages draw on national and international sources (OSN, plus IPhO, IOI and IOAA) and label every topic with the syllabuses that list it; each page says where its content comes from and how far it was compared. The planner, quiz bank and mastery estimates are still OSN-only. Do not claim an international planner until one is built. See [syllabus expansion](../product/syllabus-expansion.md).

## Voice

The voice borrows from file labels (`readme.md`, `about.md`, `requirements.txt`): plain, precise, no hype. State what a thing is and what it does. Do not use superlatives or promotional phrasing. The code-label eyebrows on the site are part of this voice; see the note about using them as the only heading style in [the design review](../reviews/design-review-2026-10.md).

## Where each element appears

| Element | Where it appears |
| --- | --- |
| Tagline | Home hero heading (`home.heroTitle`), footer (`footer.tagline`) |
| Motto | Footer, under the tagline (`footer.motto`); home hero, below the links, one word per colour (`components/site/credo.tsx`, a constant, not a message) |
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
- Do not claim an international planner, or editorial authorship credentials, that the repository cannot support. Claim an international syllabus source only as far as its provenance block says it was compared.
- Do not use "CHE" as a public label.
- Do not use the free `vercel.app` subdomain as the public face once a domain exists.
- Do not buy or register a domain on the project's behalf without the owner. The recommendation is a `.org` or `.com` on "projectcherenkov", with an optional `.id` redirecting to it; avoid cheap novelty TLDs.

## See also

[Overview](overview.md), [inspiration and philosophy](inspiration-and-philosophy.md), [colour](../design/colour.md), [visual identity](../design/visual-identity.md).
