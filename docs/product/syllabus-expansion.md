# Syllabus expansion: national and international sources

> Written 2026-11-08. Status: plan only. Nothing here is built, and no code in `lib/syllabus` has changed. The goal is decided; the model and the wording of the labels are proposed and need the owner's confirmation.

Related: [syllabus sources](syllabus-sources.md), [product identity](../project/product-identity.md).

## Goal (decided)

Use both national (OSN) and international syllabuses, and label the sections and topics that appear in both. The motivation is physics: the official OSN guide says little about physics scope, so the public international syllabus (IPhO) can fill gaps. The other two international syllabuses are IOI (informatics) and IOAA (astronomy).

Informatics and astronomy are in a different position from physics. According to [syllabus sources](syllabus-sources.md), the informatics list already follows the IA TOKI OSN syllabus, which says it follows the IOI syllabus with adjustments, and the astronomy list already follows the senior IOAA syllabus, which OSN astronomy is reported to follow. For those two subjects the expansion is mostly about labelling overlap honestly. For physics it adds scope.

## Current model

`SubjectSyllabus` in `lib/syllabus/types.ts` has one `source` and one `sourceLang`, plus sections that hold topics. Each topic has a stable `id`. Editorials and materials point at topic ids through their `topic` and `syllabusTopic` frontmatter, so ids must not change. Retitle through `name` instead.

## Proposed model

Each subject keeps one list of sections and topics. Each topic gets a membership, for example `in: ["osn"]`, `in: ["intl"]` or `in: ["osn", "intl"]`. Each syllabus (OSN, and the relevant international one) has its own `source`, with its own `accessed` date.

The existing rule stays: a date in `accessed` is a claim that the data was compared with the source, so leave it unset until that comparison has been done.

Ids of existing topics do not change. New topics get new ids.

## Labels in the interface (proposed)

- "OSN and international": the topic is in both.
- "OSN only": the topic is in the OSN source and not in the international one.
- "International only": the topic is in the international syllabus. For physics this wording must never imply that OSN covers the topic. Use something like "In the IPhO syllabus; not confirmed in the OSN guide".

## Honesty rules

- Do not mark a topic as OSN-confirmed unless it appears in the OSN source.
- The physics OSN source is still unverified. The Ministry PDF host blocks automated access (see [syllabus sources](syllabus-sources.md)). Record that status in the data and in the UI until someone has compared the list with a readable copy.
- Do not invent topics. Every topic must come from a source that is named in its syllabus `source`.
- Do not mention IOI, IPhO or IOAA in site metadata until this is built.

## Out of scope for now

Any change to `lib/syllabus`, the planner or the quiz bank. The planner is OSN-only; do not generalise it in this pass.

## Suggested order of work

1. Confirm the model and the label wording with the owner.
2. Add the membership field and the second source to the types, with every existing topic defaulting to its current source. Existing tests in `lib/syllabus/index.test.ts` must keep passing.
3. Compare the physics list with a readable copy of the OSN guide, then set `accessed`.
4. Add international-only physics topics from the public IPhO syllabus, each with its source.
5. Update the syllabus pages and the docs, and only then mention the international syllabuses in metadata.
