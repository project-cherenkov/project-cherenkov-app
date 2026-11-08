# Project Cherenkov: overview

> Written 2026-11-08. Status: current. For the identity (name, promise, voice) see [product identity](product-identity.md). Code and `README.md` are the source of truth for what is built.

## What it is

Project Cherenkov is a growing archive of olympiad ideas made visible. Each editorial is a full proof or derivation paired with an interactive visualization, and is filed by the mistake it corrects (the `principle` and `errorType` frontmatter fields) instead of by syllabus chapter. Around the archive sit a syllabus, short materials, and an Indonesian OSN study planner with a study companion called Neutrino.

It is open source. Content is git-tracked MDX, the repository is public, and the site is hosted on Vercel.

## Who it is for

Today the project is Indonesia-first: the syllabus is the OSN syllabus, the planner follows OSN stages and dates, and the interface is available in Indonesian. It is not meant to be limited to Indonesian olympiads, and the editorials themselves are not specific to one country. Nothing in the product claims an international syllabus or planner, because none has been built yet. The plan for labelling national and international syllabus topics is in [syllabus expansion](../product/syllabus-expansion.md).

## The three sections

| Section | What it is | Where it lives |
| --- | --- | --- |
| Syllabus | The official OSN scope for each subject, topic by topic, showing which topics already have a material or editorials. | `lib/syllabus/data/*.ts` |
| Materials | Short, topic-by-topic breakdowns of the syllabus. No visualization requirement. | `content/materials/<subject>/*.mdx` |
| Editorials | The archive proper: a full proof or argument and a working visualization for each idea. | `content/editorials/<subject>/*.mdx` |

## The editorial format

The current editorials follow one pattern: the problem, the idea, the interactive visualization, the full proof or argument, and optionally further reading. This is a writing convention, not a schema rule. Each editorial names a `principle` (the general idea it teaches) and, where there is one, an `errorType` (the specific mistake it corrects). Both are free text for now. The frontmatter fields are in `content/docs/en/writing-editorials.mdx` and README Section V.

## The planner and Neutrino

Signed-in students can set their OSN stage, weekly hours and topic self-ratings, and get an adaptively scheduled study plan. Neutrino is the study companion: a draggable mascot with an FAQ, a study timer and an optional AI chat. The planner is OSN-only today. See [phase 3 planner](../product/phase-3-planner.md) and [Neutrino mascot](../design/neutrino-mascot.md).

## Subjects, and why only three

The subjects are informatics, physics and astronomy, and no others. The identity is built around these three: the mark, the Neutrino companion, the colours and the Cherenkov-radiation concept all come from physics and astronomy, and informatics shares the same habit of making a hidden mechanism visible. Adding biology, chemistry or mathematics would mean redoing the identity, not just adding content. The test for a new topic is in [product identity](product-identity.md).

## Language

Main writing (editorials and materials) is in English. The interface and the planner are bilingual, English and Indonesian. The tagline and the motto are not translated; see [product identity](product-identity.md).

## Openness

Editorials are plain MDX files in a public repository, so the commit history is public. Visitors can read all public content without an account. Editing happens by editing files, or through the in-site Keystatic editor, which writes back to the same files. See `README.md` Sections V and VII.

## Status

For current numbers (how many editorials, materials and questions exist) read `README.md` Section XIII, which is kept up to date more often than this file. As of 2026-11-08 the content is still thin, the site is `noindex` until the indexing switch is turned on, and broad promotion is deliberately held back until each subject has more editorials (see [product identity](product-identity.md)).

## Where to read next

- Identity and voice: [product identity](product-identity.md)
- The reasoning behind the look: [inspiration and philosophy](inspiration-and-philosophy.md)
- Colour: [colour](../design/colour.md)
- The docs index: [docs README](../README.md)
