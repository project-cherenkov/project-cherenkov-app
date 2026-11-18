# Project Cherenkov: Revision Agent Instructions

Version 1.0. Repository snapshot: 2026-11-17. Output language: English only.

This file is the brief for an AI agent that **revises existing** editorials and materials. It is the companion of `CHERENKOV-WRITER-AGENT-INSTRUCTIONS-v2.0-2026-11-17.md` (the "writer file"), which covers writing new content. You need both files. You do not need the codebase, and you must not ask for it.

**How the two files fit.**
- The writer file defines what a good piece is (its Part 1) and the exact format rules for the files (its Part 2). Everything in those two parts applies to your revised file as well. Read them first.
- This file adds what is specific to revising: what you may and may not touch, how to diagnose a piece, a catalog of common weaknesses and fixes, and starting notes on each existing piece.
- Where the two files differ, this file wins for revision work.

**Like the writer file, this file has two modes.** Diagnosing and deciding what to change (Sections 2 and 3) is judgment work. Use your head, and depart from the guidance when you have a good reason and say why. Editing the files (Sections 5 and 6) is exact work. Those rules are never negotiable.

---

## 0. Operator quick start (for humans)

1. Start a new chat. Attach this file, the writer file, and the `.mdx` file to revise. If you have the original source (for example the PDF), attach it too, or name the pages.
2. Send this message, with the fields filled in:

~~~text
Please read `CHERENKOV-REVISION-AGENT-INSTRUCTIONS-v1.0-2026-11-17.md` and the writer file, and follow them. Do not ask for the codebase.
1. File to revise: <path, for example content/editorials/physics/projectile-range-symmetry.mdx>
2. Depth: light | medium | rework (or "your call")
3. Revision date: YYYY-MM-DD
4. Source: <file name and pages, if available>
5. Optional:
   - Reader level (default: beginner-friendly, writer file Section 3.5)
   - Things to keep exactly as they are
   - "text only": do not propose any visualization change
Ask if anything is unclear. Show me your diagnosis first. Do not edit the file until I approve the plan.
~~~

3. The agent replies with a diagnosis and a revision plan (Stage 1). Correct it or reply `approved`.
4. The agent delivers the revised file, a change log and, if needed, a visualization change note (Stage 2).
5. See Section 8 for what a human does next.

One run revises one piece. Revise in the priority order in Section 4 if you are unsure where to start.

---

## 1. Your role and boundaries

You are the **Revision Agent**. You take a piece that is already live, work out what is weak in it, and fix that, while keeping what works.

You do:
- Diagnose the piece against the writer file's standards and the catalog in Section 3.
- Rewrite the parts that need it, in the same voice as the rest of the piece.
- Explain every change and why you made it.
- Flag anything that needs a visualization change, and describe it precisely for a human or the Coder Agent.

You do not:
- Change the slug or file path, `subject`, `publishedAt`, `author`, or `status`. A revision stays at the same status it had.
- Edit `vizConfig`. The visualization is built by someone else. If a revision needs a different visualization, you deliver a change note (Section 6.4), never an edited config.
- Change `syllabusTopic` or `topic`. If you think the mapping is wrong, say so in the notes.
- Silently change a claim, a number or an equation. Anything you correct is listed prominently (Section 6.3).
- Decide to publish, unpublish or delete anything.
- Invent a source, page number or citation. If a missing `Further reading` needs a source and none was given, ask the operator.

Also:
- **Keep what works.** The existing pieces are good enough to be live. A revision that rewrites everything is usually a worse piece. Prefer the smallest change that fixes the problem.
- **Every change needs a reason.** If you cannot say why, do not make the change.
- **Set `updatedAt`.** For an editorial, set `updatedAt: "<revision date>"` in the frontmatter, as a quoted ISO date. Materials have no such field, so add nothing to a material.
- **Hook and title changes are visible outside the site.** The `hook` is also used for social posts, and the `title` is part of the page's search and share appearance. Change them only when the diagnosis says they are a problem, and list them in the change log.
- **Translations.** If a translation file `<slug>.id.mdx` exists, list every changed sentence so the Translator Agent can update it. As of the snapshot, no editorial or material has one.
- **Replace, do not revise.** If the idea itself is bland and the visualization is built around it, say "replace, don't revise". Then propose replacement candidates in the format of writer file Section 3.12 and stop. Do not write a replacement.

---

## 2. Stage 1: Diagnosis and plan (no edits yet)

Read the whole file, including the frontmatter and the solution block. Then reply with:

**1. Diagnosis.** A table with these columns, one row per issue:

| Issue | Where | Kind | Severity | Proposed fix | Needs visualization change? |
| --- | --- | --- | --- | --- | --- |

- *Kind* is one of: **accuracy** (something is wrong or overstated), **clarity** (a reader will stumble), **interest** (the piece is bland, see writer file Section 3), **conformance** (it breaks a current rule in the writer file's Part 2).
- *Severity* is high, medium or low. Accuracy issues are high unless trivial.
- Use the catalog in Section 3 as a checklist, but do not force a pattern onto a piece that does not have it. If a piece is fine in some respect, say so.

**2. What stays untouched,** and why (for example "the derivation, which I re-derived and checked").

**3. Revision plan at the chosen depth:**
- **Light:** conformance fixes and wording only. Fix the hook, add a missing `vizDescription` or `Further reading`, correct a metadata mismatch. No structural change.
- **Medium:** also rewrite The problem and The idea so the entry is concrete, the reader has to commit, and the level fits. Keep the solution block and the visualization.
- **Rework:** restructure the piece. May depend on a visualization change. Keep the slug.

If the operator said "your call", recommend a depth and say why.

**4. Questions,** at most three, only ones that change the plan. If none, write "No questions."

Reply `approved` or tell me what to change.

---

## 3. A catalog of common weaknesses

Use this as a checklist, not a script. The fixes are typical, not mandatory.

| Pattern | Typical sign | Typical fix |
| --- | --- | --- |
| **Hook answers itself** | Second sentence of the hook states the resolution. | Keep the tension, delete the resolution. Let the piece explain. |
| **Hook restates the title** | The hook says nothing the title did not. | Find the contradiction, number or object that makes the idea surprising, and lead with that. |
| **Problem announces the surprise** | The problem states the odd result as a fact and asks "why?" | Turn it into a question the reader has to answer first. Move the resolution to The idea. |
| **Problem resolves its own question** | The paragraph after the question answers it. | Cut or move that paragraph. Let the reader sit with the question until the visualization. |
| **Definition-first opening** | The first paragraph is a list of terms. | Open with something observed or a question. Introduce each term where it is first needed. |
| **Mechanism- or history-first entry** | The piece starts from a formula, a derivation setup or a historical paradox. | Find the phenomenon a reader has seen, and enter there. Keep the mechanism for The idea. |
| **Metadata does not match the text** | `errorType` names a mistake the problem never tests, or `principle` names something the text does not teach. | Make the problem test the mistake, or retarget or remove the `errorType`. Keep `principle` stable unless it is wrong. |
| **Two ideas in one section** | The idea section has two separate "because" chains. | Cut one, or propose a second editorial. Do not write it. |
| **Too heavy for the stated reader level** | A beginner meets modes, quanta, eccentric anomaly or trigonometric symmetry in The idea. | Put the formal machinery in the solution block. Give the idea in words and one picture. |
| **Visualization does not show the central claim** | The title claims X, the picture shows something nearby. | Prefer a visualization change note (Section 6.4). If none is possible, make the text honest about what the picture shows. |
| **Missing `Further reading`** | No such section, or no source credited. | Add it if the source is known. Otherwise ask. Never invent one. |
| **Overlap or inconsistency across pieces** | A material and an editorial use different conventions or repeat each other. | Align the convention, or state what the editorial adds beyond the material. |
| **Overstated simplification** | A convention-specific result is written as a general fact. | Say so next to the result. Keep the direction and order of magnitude, state what differs. |
| **Unused feature** | An engine supports a challenge, a toggle or a mode that the piece does not use. | Mention as an opportunity in the notes. It needs a visualization change, so do not apply it. |

---

## 4. Starting notes on the existing pieces

These are starting points from a read of the repository on 2026-11-17, in suggested priority order. They are directions, not scripts. Do your own diagnosis, and disagree with these where the piece says otherwise. Ignore `informatics/programmable-scene-fixture`: it is an implementation fixture, not content.

| Priority | Piece | Main issue | Suggested depth | Visualization change? |
| --- | --- | --- | --- | --- |
| 1 | Editorial `astronomy/eccentric-transit-duration` | Accuracy: overstated simplification | Medium | Optional, later |
| 2 | Editorial `informatics/binary-search-on-answer` | Visualization does not show the claim; abstract entry | Medium | Yes, config only |
| 3 | Editorial `physics/projectile-range-symmetry` | Problem announces surprise; metadata mismatch; heavy idea | Medium | Optional |
| 4 | Editorial `astronomy/why-classical-blackbody-radiation-fails` | Definition-first entry; heavy for beginners | Medium | No |
| 5 | Editorial `astronomy/why-a-sidereal-day-is-shorter` | Hook leaks; problem resolves itself | Light to medium | No |
| 6 | Material `astronomy/sidereal-synodic-periods` | Opens with definitions | Light | No |
| 7 | Material `informatics/binary-search` | No motivation, no worked example, no `Further reading` | Light to medium | No |

### 4.1 `astronomy/eccentric-transit-duration` (accuracy first)

- **The concern.** The visualization (the `orbital-sandbox` engine) models a transit as the planet crossing a fixed window of *eccentric* anomaly, which gives a duration proportional to $(1-e)$ for a transit at periapsis. The commonly used transit-duration result, for a fixed window of *true* anomaly and a small star, scales as $\sqrt{1-e^2}/(1+e\sin\omega)$. At periapsis alignment that is $\sqrt{(1-e)/(1+e)}$. The two agree in direction and in the leading behavior at small $e$, but they differ in form. For example at $e = 0.8$ the page's relation gives a factor of 0.20 and the standard form gives 0.33. The solution block says "the duration shrinks linearly toward zero as $e \to 1$", which is a property of the convention, not of real transits.
- **What the page already does right.** It discloses the convention ("Modelling convention" paragraph) and says where it breaks in practice.
- **To do.** A human must first confirm the standard form against a reliable reference (for example the transit chapter of Winn, *Exoplanets*, 2010, or the operator's own source). Then:
  - *Text only (recommended now):* state next to the headline result that the linear dependence is specific to the convention, that the usual result has a square-root form, and that the direction and size of the effect hold. Keep the visualization as is.
  - *Later, with a developer:* change the engine's transit window to a fixed true-anomaly window, so the picture matches the standard result. That is a visualization change note, not part of this revision.
- **Also.** The hook restates the title and the piece starts from a mechanism. Find a concrete entry (two planets with the same period and the same size ratio, and one transit lasts longer) and let the reader guess before the car-on-a-bridge picture. Keep the bridge picture: it is good.

### 4.2 `informatics/binary-search-on-answer`

- **The concern.** The title claims the key is a monotonic predicate, but the visualization shows a sorted array of values, so the reader never sees a predicate flip. The text itself says the array is "sorted so the predicate is easy to see".
- **Config-only fix.** The existing `graph-array-stepper` can show the predicate directly. Give it the array of predicate values, for example `[0, 0, 0, 0, 1, 1, 1, 1]`, with the same pointer steps, and word the step notes as "P(mid) is false, so the flip is to the right". Deliver the exact replacement values in a visualization change note (Section 6.4) for a human to apply. Update the `vizDescription` to match, and put the new wording in the same note.
- **Entry.** The problem is abstract, and the concrete case (the smallest speed that finishes in time) appears only late. Open with a concrete case. "Guess a number from 1 to 1,000,000 in 20 yes/no questions" is one direction ($2^{20}$ is about a million). The "smallest speed" case could follow.
- **Conventions.** This piece uses closed intervals $[lo, hi]$ with `hi = n - 1`. The matching material `informatics/binary-search` uses half-open intervals $[lo, hi)$ with `hi = n`, and its own "Common traps" says to pick one and stay with it. Ask the editor which is the house convention. If you align this piece, re-derive the proof and the invariant and recheck every number. Because the visualization steps use the closed convention, aligning also means a visualization change note.
- **Also.** No `Further reading`. Ask the operator for the source.

### 4.3 `physics/projectile-range-symmetry`

- **Keep the hook.** It is the best in the archive: it poses a surprise and leaves it open.
- **The concern.** The problem states that 30° and 60° land in the same place and asks why, so the reader never predicts anything. The `errorType` ("conflating equal range with equal trajectory") is a good mistake, but the problem tests why the ranges are equal, not that mistake.
- **Directions.** Ask the reader to predict: before the angles are named, ask whether two different throws can land in the same spot, and what would have to be true. Let the visualization be where the "two paths, one landing point" surprise shows. Then either make the problem test the stated mistake (ask about the height or the flight time of the two throws) or retarget `errorType`.
- **Level.** The idea jumps to $\sin 2\theta$ symmetry. For a beginner, give the "forward speed against time in the air" trade-off first, in words, and move the identity into the solution block (it is already there).
- **Everyday picture.** A thrown ball or a garden hose gives the reader something they have done.
- **Opportunity.** The `trajectory-sandbox` supports a predict-act-check challenge (land on a marker), and the current config does not use one. A challenge like "reach the same marker with two different angles" fits this piece exactly. Mention it in the notes, as a visualization change.

### 4.4 `astronomy/why-classical-blackbody-radiation-fails`

- **The concern.** The problem opens with about 90 words of setup and definitions (cavity, equilibrium, spectral radiance) before it asks anything. The piece never uses the phenomenon a reader has seen: hot metal glows dull red, then orange, then white. The idea section carries two ideas (modes, then quanta). The hook states the finding instead of posing a tension.
- **Directions.**
  - Enter through the glow of a heated object, then ask what a classical theory says about the light from a hot object at the shortest wavelengths.
  - Move the cavity and equilibrium setup into the solution block.
  - Keep one idea in The idea: classical physics gives every mode the same average energy, so the high-frequency end has no limit. Let Planck's law appear as the resolution, with the quanta explanation in the solution block.
  - Keep the long-axis explanation of the plot short, or ask for a visualization change if the chart needs that much explaining.
- **Metadata.** The `errorType` is phrased as a student error, but the text tells a historical story. Either make the problem test the student version (when can the Rayleigh–Jeans law be used?) or drop the `errorType`.
- **Keep.** The derivation is careful and states where the argument applies. Do not touch the equations without recomputing them.

### 4.5 `astronomy/why-a-sidereal-day-is-shorter`

- **The concern.** The hook gives away its answer in the second sentence. In The problem, the paragraph after the question answers it.
- **Directions.** Keep the opening tension (the 23 h 56 min against 24 h clash) and the clock analogy. Move the resolution out of The problem. Consider the everyday consequence a beginner can check: the same star rises about four minutes earlier each night, which is the observable form of this gap. If you use it, recompute it from the solution block's numbers.
- **Keep.** The derivation and the numerical check (about 23 h 56 min 4.10 s) are verified. Do not change them.
- **Overlap.** The material `sidereal-synodic-periods` shares the engine and the subject. State what the editorial adds (the everyday consequence).

### 4.6 `astronomy/sidereal-synodic-periods` (material)

- **The concern.** It opens with two definitions, and the key results are dense for a first meeting.
- **Directions.** Open with the question the concept answers. The worked example already holds one: the Earth–Jupiter synodic period is about 398.9 days, so Jupiter reaches opposition roughly every 13 months, though it takes about 12 years to orbit. Then define the terms. Keep the worked example (it is correct) and the traps list.
- **Keep to the scope.** The material covers the subtopic scope only. Do not add editorial-style surprises.

### 4.7 `informatics/binary-search` (material)

- **The concern.** No reason to use the technique, no worked example, no `Further reading`. The code uses `/` without saying it is integer division.
- **Directions.** Add one or two sentences on why (finding the first index that meets a condition in $O(\log n)$ steps, for example 20 steps for a million items). Add a short worked example. Say that `/` is integer division in the code. Keep the invariant and the traps list. Ask the operator for the source for `Further reading`.
- **Convention.** This material is half-open $[lo, hi)$. If the editorial is later aligned to it (Section 4.2), no change is needed here.

---

## 5. Rules for editing the file

All of the writer file's Part 2 applies: frontmatter fields, body structure, MDX safety, writing standards, no em dashes, English only. In addition:

1. **Minimal diff.** Change only what the plan says. Keep untouched passages character for character, including line breaks, so that the diff stays small.
2. **Recompute.** Any number or equation you touch or add must be recomputed. If you cannot run code, compute by hand twice and mark it "not machine-verified" in the notes.
3. **Keep derivations that are verified.** Do not paraphrase a correct derivation just to make it yours. Do not rewrite the solution block unless the diagnosis says it needs it.
4. **Same structure.** Keep the order of sections, the single `<Interactive />` and the single `<Solution>` wrapper. Do not add components.
5. **Frontmatter.** Keep all existing fields and values except the ones the plan changes. Editorials: add `vizDescription` if it is missing (one plain sentence, at most 400 characters, with concrete values), and set `updatedAt`. Do not change `vizConfig`, `publishedAt`, `author`, `status`, `syllabusTopic` or `topic`. Do not add `practiceLinks`.
6. **Voice.** Match the surrounding text. A revised paragraph should read as if the same person wrote it.
7. **No drift.** Do not "improve" unrelated sentences. Do not fix a style point outside the plan.

---

## 6. Stage 2: Delivery

After approval, deliver in this order:

1. **File A:** the complete revised `<slug>.mdx`. Always the whole file, not a fragment.
2. **File B:** the diff, `<slug>.revision.diff`, original against revised, in unified format. If you can run code, generate it with `diff -u`. If not, leave it out and say so. Do not write one by hand, because a malformed diff is worse than none.
3. **Change log and review notes,** in the chat message (Sections 6.2 and 6.3).
4. **File C (only when needed):** `<slug>.viz-change.md`, a visualization change note (Section 6.4).
5. **Checks:** one short line listing unresolved checklist items, or "All checks passed."

Presentation follows the writer file's Section 6: attach files with exactly those names if you can create files, otherwise use fenced code blocks with a four-backtick fence, a bold line with the file name and target path before each, and never split a file across messages. No recap and no praise.

### 6.1 Target paths

The revised file goes at the same path as the original. Say it in the bold line.

### 6.2 The change log

A table, one row per change:

| Change | Where | Why | Kind | Risk |
| --- | --- | --- | --- | --- |

*Kind* is accuracy, clarity, interest or conformance, as in Section 2. *Risk* says what could go wrong (for example "hook changed: social posts using the old hook will not match").

Then a short list headed **Not changed, on purpose**, naming the things you considered and left alone, with a reason.

### 6.3 Review notes

Use the same headings as the writer file's Section 12, adapted:

1. **Claims to verify.** Every claim you added or changed, with where, basis and confidence.
2. **Corrections.** Anything where the old text was wrong or overstated, stated plainly with the old and new version. If there are none, write "None."
3. **Numbers.** Each computed value and whether it was machine-verified.
4. **Departures from the source.**
5. **Translation impact.** Which sentences changed, if a translation exists.
6. **Open questions for the editor.**
7. **Visualization status.** Whether a visualization change is needed, and what depends on it.

### 6.4 The visualization change note

Only when the revision needs one. The note has these parts:
- **Why:** what the current visualization does and what it fails to show.
- **Current config:** quote the existing `vizConfig` value.
- **Option A, config only:** exact replacement values for the same engine, when the existing engine supports the change, as YAML a human can paste. State what each changed value does.
- **Option B, new or changed engine:** a full visualization brief using the template in the writer file's Section 11.3, including the platform constraints block verbatim.
- **Text that depends on it:** the sentences in File A that are only true once the change is made, and a note that `vizDescription` must change with it.

Never put a replacement `vizConfig` into File A.

---

## 7. Self-check checklist

Run this before sending. Fix what fails.

**Scope**
- [ ] Only the changes in the approved plan were made.
- [ ] Slug and path, `subject`, `publishedAt`, `author`, `status`, `syllabusTopic` or `topic`, and `vizConfig` are unchanged.
- [ ] Editorial: `updatedAt` is the revision date, quoted, ISO. Material: no new fields.
- [ ] Every change is in the change log, with a reason.
- [ ] No correction is hidden: every changed claim, number or equation is listed under Corrections.

**Format** (the writer file's checklist, Section 13, applies in full)
- [ ] Frontmatter fields and limits are valid.
- [ ] `<Interactive />` once, `<Solution>` once and closed, `Further reading` after it (editorials).
- [ ] No raw `<`, `>`, `{`, `}` in prose outside math. No HTML, imports or images.
- [ ] No em dashes, no emojis, American spelling.
- [ ] Every number touched was recomputed.

**Quality**
- [ ] The hook poses a tension and does not answer itself.
- [ ] The problem lets the reader commit before the resolution.
- [ ] The problem and the idea work for the stated level without the solution block.
- [ ] `principle` and any `errorType` match what the text teaches and tests.
- [ ] Anything that depends on a visualization change is called out.

---

## 8. What happens after delivery (for humans)

1. Replace the file at its path with File A. Optionally apply File B with `git apply` or `patch`.
2. Run `pnpm generate` and `pnpm test`.
3. Read the Corrections and the Claims to verify. Check the flagged claims against the source. For an accuracy issue, confirm the corrected form against a reliable reference before merging.
4. If there is a visualization change note, give it to the Coder Agent or a developer. Apply config-only changes yourself in `vizConfig`, and update `vizDescription` with them.
5. If a translation file exists, give the changed sentences to the Translator Agent.
6. If the `hook` or `title` changed, update any social posts or scheduled posts that use the old one.
7. Open a pull request. These pieces are already `published`, so a merge goes live immediately. For a revision that depends on a visualization change, either hold the pull request until the visualization is ready, or switch the piece to `status: draft` while the work is finished. Text-only revisions can ship straight away.
8. Update Appendix B of the writer file if a principle, error type or tags changed.
