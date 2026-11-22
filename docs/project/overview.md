# Project Cherenkov: overview

> Written 2026-11-08. Status: current. For the identity (name, promise, voice) see [product identity](product-identity.md). Code and `README.md` are the source of truth for what is built.

## What it is

Project Cherenkov is a growing learning archive for olympiad informatics, physics and astronomy. Its syllabus maps the territory, materials establish the essential concepts behind syllabus topics, and editorials independently investigate particular questions through interactive visualizations and rigorous reasoning. Around these content sections sit an Indonesian OSN study planner and its study companion, Neutrino.

It is open source. Content is git-tracked MDX, the repository is public, and the site is hosted on Vercel.

## Who it is for

Today the project is Indonesia-first: the syllabus is the OSN syllabus, the planner follows OSN stages and dates, and the interface is available in Indonesian. It is not meant to be limited to Indonesian olympiads, and the editorials themselves are not specific to one country. Nothing in the product claims an international syllabus or planner, because none has been built yet. The plan for labelling national and international syllabus topics is in [syllabus expansion](../product/syllabus-expansion.md).

## The three sections

| Section | What it is | Where it lives |
| --- | --- | --- |
| Syllabus | The scope map: subjects, topics and subtopics, with source provenance and links to available learning content. | `lib/syllabus/data/*.ts` |
| Materials | Self-contained explanations of a topic or subtopic's essential concepts: definitions, relationships, key results, derivations, procedures and common traps. Every published material has a meaningful interactive visualization. | `content/materials/<subject>/*.mdx` |
| Editorials | Independent investigations of a question, case, phenomenon or problem. Each uses an interactive visualization to let readers examine its central reasoning and develops the argument through a proof, derivation or other appropriate reasoning. | `content/editorials/<subject>/*.mdx` |

## How materials and editorials relate

Materials and editorials are complementary, not dependent on one another or a mandatory sequence. A material establishes the essential conceptual framework for a syllabus topic or subtopic; an editorial begins with a particular question or situation and investigates it. An editorial should be independently understandable, may link to a related material for broader foundations, and should add an investigation rather than repeat the material. A topic can have either, both or neither. Both formats require meaningful interactive visualizations before publication, but the visualization serves a different purpose in each: conceptual clarification in a material, focused exploration in an editorial.

Editorials are organised by `principle`, the general idea they teach. An `errorType` is optional and should be used when a specific misconception is genuinely relevant. Editorials may link to a syllabus topic through the optional `syllabusTopic` field; materials link directly to a topic.

## The editorial format

The editorial explanation establishes the question, idea and reasoning before the visualization is designed. The interaction then lets readers inspect or test a relationship central to the argument; it does not supply missing reasoning. Materials follow the same explanation-first principle, with a smaller visualization that clarifies the topic's conceptual structure. The authoring workflow and format standards are in [the Writer Agent Instructions](../agents/CHERENKOV-WRITER-AGENT-INSTRUCTIONS-v2.1-2026-11-21.md) and [the in-app writing guide](../../content/docs/en/writing-editorials.mdx).

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
