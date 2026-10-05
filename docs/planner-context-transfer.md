# Project Cherenkov — Study Planner: Research Findings & Context Transfer

> **Update 5 Oct 2026:** Section 8 steps 4–6 are now built (`lib/plan-scheduler.ts`, `scripts/simulate-planner.ts`, the `/planner` UI) — see `docs/phase-3-planner.md`. Effort values and all [PLACEHOLDER] numbers are still unresolved.

**Audience:** a future AI agent (same or lower capability than the author) who will design or build the Phase 3 study planner.
**Written:** 3 October 2026. **Revised 4 October 2026:** the open questions in Section 6 are now answered, and the data layer (Section 5, items 1–5 and 7, partly) is delivered as `phase3-data-layer.patch`. The scheduler and mastery estimate are still NOT built.
**How to read this:** Section 0 is the whole story in one page. Sections 1–2 give context. Section 3 is the research. Section 4 is the recommended design. Section 5 maps it onto the repo. Section 6 lists open questions. Section 7 lists sources with an honesty rating of each.

Labels used throughout:
- **[USER-DECIDED]** — the user said this explicitly. Do not change without asking.
- **[RESEARCHED]** — found in a source listed in Section 7.
- **[PROPOSED]** — my own suggestion. Not validated against data. Treat as a starting point, not a fact.
- **[PLACEHOLDER]** — a number or value I made up only so the design is concrete. The user wants placeholders clearly labelled rather than passed off as real values. Replace before shipping.

---

## 0. One-page summary

**What the user wants:** a Phase 3 study planner for the **OSN** (Olimpiade Sains Nasional) path of the website. They asked me to **reuse established algorithms** instead of inventing a new one, and to hand over findings in this document. They do not want code written yet.

**User decisions [USER-DECIDED]:**
1. Phase 3 is **OSN only**. TKA/UTBK planning is **Phase 4**.
2. The planner schedules **syllabus topics** (not editorials) on the OSN path.
3. The planner is **mostly a revision tool**: students already know much of the material.
4. Prior knowledge is captured by **self-rating per topic first, then a quiz to confirm**.
5. The student **chooses the OSN stage** the plan targets: kabupaten/kota (OSN-K), provinsi (OSN-P), or nasional. The city and province levels use **the same syllabus** as national, **just easier questions** (the user said "different difficulty").
6. The user **left calendar-vs-rolling to me**. My decision: a **calendar view backed by a rolling recommender** (the "today" list is the main surface; the calendar is the plan regenerated from it; past and completed items are frozen).
7. Adopt existing algorithms where possible; integrate with the repo "if necessary".

**The key finding:** no single published algorithm solves this whole problem. The problem splits into four sub-problems, and each has a well-known method:

| Sub-problem | Best-fit established method | Use now? |
|---|---|---|
| A. What does the student already know? (initial assessment) | Adaptive assessment from **Knowledge Space Theory / ALEKS** (idea only), plus a **Beta-posterior** per topic with self-rating as a weak prior | Idea + simple Beta estimate: yes. Full KST: no |
| B. Where should limited hours go? | **Region of Proximal Learning** + a need ÷ effort allocation | Yes (simple rule) |
| C. When should I revisit topics before the exam? | **Exam-anchored expanding spacing ladder** (Cepeda et al. 2008 as default); **FSRS** later | Ladder: yes. FSRS: later, once there is per-question data |
| D. In what order inside a session/day? | **Interleaving** (Rohrer et al. 2020 RCT) | Yes (cheap rule) |

**Do not** build: deep knowledge tracing, Bayesian knowledge tracing, reinforcement learning, bandits, integer programming, or LLM-generated schedules. Reasons in Section 3.9.

**Biggest blocker is data, not math.** The repo has about 4 planner topics, almost no quiz questions, and stores only an aggregate score per attempt. Section 5 lists the data work that must come first.

---

## 1. Project context (what a new agent needs to know)

**Project Cherenkov** is a Next.js website for an Indonesian olympiad (OSN) editorial project covering **informatics, physics, astronomy**. The site has editorials (rigorous proofs paired with interactive visualizations), "materials" (breakdown of the official syllabus), and a "syllabus" section.
- Stack: Next.js 15 (App Router) + TypeScript, Tailwind, shadcn/ui, MDX via Velite, next-intl, **Neon Postgres + Drizzle ORM (0.45) + Better Auth**, Vitest 2, pnpm 9.15, hosted on Vercel.
- Phase 1: public archive, no login. Phase 2: optional accounts + a basic study planner (built). Phase 3: **this task**, adaptive planner (documented as a sketch in `docs/phase-3-architecture.md`, "not implemented").
- The user wants **placeholder labels** for undecided content and **deliverables as downloadable files** (a patch file or zip for code).
- The repo owner treats **code as the source of truth** over README/docs.

### 1.1 What the planner does today (from reading the uploaded repo `project-cherenkov-app-main.zip`)

Files (all under `lib/`): `plan-generator.ts`, `planner.ts`, `planner-sync.ts`, `planner-actions.ts`, `quiz-scoring.ts`, `syllabus/` (`index.ts`, `types.ts`, `define.ts`, `data/{informatics,physics,astronomy}.ts`), `db/schema.ts`.

DB tables relevant to the planner (`lib/db/schema.ts`): `topics`, `quiz_questions`, `quiz_attempts`, `study_plans`, `plan_items`. (`user`, `session`, `account`, `verification` belong to Better Auth.)

Behaviour, as described in an earlier research note that I (a previous session) wrote after reading the code. I re-confirmed the file list and exports but **did not re-run the app or tests**:
- `generatePlanItems` sorts topics subject-first (informatics, physics, astronomy), then by `order`, and puts topic *i* of *n* on day `floor(i·W/n)` where *W* = days until exam. Every topic appears **once**. If there are more topics than days, topics silently stack on the same day. It is pure, deterministic and tested.
- Topic status is computed from the **most recent quiz attempt only**: score ≥ 0.8 (`MASTERY_THRESHOLD` in `lib/planner.ts`) = `done`; lower = `in_progress`; none = `not_started`.
- `quiz_attempts` stores only an **aggregate score and timestamp**. No per-question record.
- `topics` rows are derived from **editorials**, not from the syllabus (`lib/seed/derive-topics.ts`; its `order` is publication order, flagged in code as "not a real curriculum order").
- Regenerating a plan deletes and reinserts `plan_items` **without `completedAt`**, so already-mastered topics get rescheduled (bug candidate).
- "Today" comes from the server clock (UTC on Vercel), but students are UTC+7, so for ~7 hours a day the planner's "today" is yesterday.
- `docs/phase-2-architecture.md` says "TKA/UTBK" while the rest of the project is OSN. The user has now settled this: OSN for Phase 3.

### 1.2 The syllabus data (important for this task)

`lib/syllabus/` holds an official-syllabus model: `SubjectSyllabus → SyllabusSection[] → SyllabusTopic[]`. Topic ids are **stable slugs, unique within a subject only** (so the planner key must be `(subject, topicId)`). Sections have `part: "theory" | "practical"`; only theory sections hold linkable topics. Roughly 95 topics total (58 informatics, 17 physics, 20 astronomy — my earlier count, not re-verified). **The syllabus has no prerequisite edges, no effort estimates, no weights, and no stage flags.** The informatics file header says it was transcribed from the national-level tab only. The physics file is still marked as having a placeholder source.

**Stage handling consequence:** because the user says OSN-K and OSN-P use the same syllabus at lower difficulty, the topic set does **not** need per-stage flags. Stage should instead change (a) the exam date, (b) the **target mastery level / question difficulty band** the planner aims for. Quiz questions therefore need a **difficulty tag** (they have none today).

---

## 2. Problem statement in plain words

Given: a student who picks one subject, one OSN stage, an exam date, and hours per week; a list of syllabus topics; a self-rating per topic; and a few quiz answers.
Produce: a plan that (1) finds out what the student really knows, (2) spends the limited hours where they help most, (3) revisits topics so they are still remembered on exam day, (4) can be regenerated without losing history, and (5) honestly says when the hours are not enough.

Because the user said "mostly revision", the main work is **diagnosis and triage**, not teaching order. That is why prerequisite graphs are demoted to optional in this design.

---

## 3. Research findings

Each entry: what it is → evidence → fit for Cherenkov → verdict.

### 3.1 Knowledge Space Theory (KST) and ALEKS — adaptive initial assessment  [RESEARCHED]
- **What:** Doignon & Falmagne's theory models a learner's knowledge as a *state* (the set of topics they have mastered) inside a structure of feasible states. ALEKS ("Assessment and LEarning in Knowledge Spaces") is its large-scale product. An **initial assessment** asks adaptively chosen questions (the next question depends on earlier answers), then classifies topics. A student is then offered topics from the **outer fringe**: topics not yet known whose prerequisites are already known, so the student is "ready to learn" them. A probabilistic model (BLIM) handles slips and lucky guesses.
- **Evidence:** deployed for millions of students (the Doignon–Falmagne chapter and an ALEKS Corporation paper). An EDM 2022 industry paper reports ALEKS later augmented the KST assessment with a neural network to improve accuracy and efficiency, which tells us the pure KST method has limits.
- **Fit:** this is the closest published match to the user's "self-rating, then quiz to confirm" flow. But KST needs a **prerequisite structure** over topics (the syllabus has none) and a large item bank per topic. Cherenkov has neither.
- **Verdict:** **borrow three ideas, not the machinery.** (1) Make the first interaction an adaptive *diagnostic*, not a plan. (2) Classify each topic as **known / not known / uncertain** (the EDM paper describes a three-way partition; I did not capture its category names, so this naming is my [PROPOSED] mapping). (3) Prefer topics at the edge of what the student knows. If prerequisite edges are authored later, the outer-fringe rule becomes directly usable.

### 3.2 Self-assessment is a weak signal  [RESEARCHED]
- Several studies (mostly university students, many medical) find self-assessment correlates only weakly with real performance; **low performers tend to overestimate and high performers underestimate**. One field experiment found that having poor performers predict their score and reflect on the gap improved both calibration and final performance (ijres.net paper, Section 7).
- **Caveat:** these samples are university students, not Indonesian olympiad candidates. Olympiad students may be better or worse calibrated. Unknown.
- **Verdict:** treat a self-rating as a **weak prior**, never as mastery. This supports the user's own choice to confirm by quiz. A product idea that follows directly: **show the student their self-rating next to their quiz result** (prediction-feedback), which the literature suggests improves calibration. [PROPOSED]

### 3.3 Region of Proximal Learning (RPL) — where to spend study time  [RESEARCHED]
- **What:** Metcalfe & Kornell's model says learners (and efficient study) should drop items they already know, then spend time on items that are **just beyond current grasp**, easy-to-medium first, turning to the hardest items later. It is contrasted with the older "discrepancy reduction" model (always study the hardest items), which the evidence does not favour. Their experiments found that allocating time to the proximal region produced the best performance among the policies tested.
- **Caveat:** the experiments used paired-associate vocabulary items, not olympiad problem-solving.
- **Verdict:** adopt as the **allocation rule**: do not spend most hours on the very worst topics first. Rank by *gain per hour*, which tends to favour medium-weak topics, and revisit the hardest ones once cheaper gains are taken. Also supports skipping topics the student has *confirmed* as strong (but see spacing, 3.4).

### 3.4 Spacing, anchored to the exam date  [RESEARCHED + PROPOSED]
- **Robust finding:** spaced practice beats massed practice. This is the strongest, best-replicated claim in this document.
- **Optimal gap depends on how far away the test is.** Cepeda, Vul, Rohrer, Wixted & Pashler (2008) found the best gap grows with the test delay but shrinks as a fraction of it (about 20–40% of a one-week delay, down to about 5–10% of a one-year delay). *I took these numbers from the earlier research note and did not re-fetch the paper this session.* Those were lab experiments on facts, so the ratios may not transfer to problem solving.
- **Product patterns seen in the wild** (blogs/tools — low evidence, but consistent): reviews roughly 1, 3, 7 days after first study plus a final pass before the exam (openeducat generator); a ladder of day 0 / 2 / 7 / 14 / 28 then mixed question-bank sessions (iatrox guide); a reserved **buffer** before the exam for light review (several tools); Picmonic's scheduler shifts time toward review as the exam approaches using an exponential-decay model and estimates review time as reviews × questions × 15 s.
- **Verdict:** implement a **simple expanding ladder anchored to the exam date** [PROPOSED]: when a topic is (re)studied with *R* days left, schedule the next review after a gap of about 15–30% of *R*, repeat until about a week remains, then put a final review pass in the buffer window. Treat the percentages as a [PLACEHOLDER] default that beats "study once", not as a calibrated optimum.

### 3.5 FSRS — item-level spaced repetition (later)  [RESEARCHED]
- **What:** Free Spaced Repetition Scheduler. Models each item with difficulty, stability, and retrievability (probability of recall now). Current version FSRS-6 (21 parameters). Ships in Anki and RemNote.
- **Ready-made library:** **`ts-fsrs`** (github.com/open-spaced-repetition/ts-fsrs). MIT licence (shown on its GitHub page), implements FSRS v6, **requires Node.js ≥ 20**, installs with `pnpm add ts-fsrs`. Core calls: `fsrs()`, `createEmptyCard()`, `scheduler.repeat(card, now)`, `scheduler.next(card, now, Rating.Good)`, and `scheduler.get_retrievability(card, now)`. A separate optional package `@open-spaced-repetition/binding` trains parameters from review logs. Check the repo's Node version (it has no `engines` field in `package.json`; Vercel's default must be ≥ 20).
- **Exam handling in practice (forum-level evidence, not authoritative):** Anki users preparing for exams commonly raise *desired retention* (about 0.95–0.97 for exam-only material) or review cards ahead of time with filtered decks shortly before the exam. Experienced forum members advise against capping the maximum interval as a hack. FSRS itself has **no concept of a deadline**; it optimizes long-run retention.
- **Why not now:** FSRS wants a stream of timestamped, graded reviews of **individual items**. Cherenkov stores an aggregate score per topic. Mapping a 0–1 score to FSRS's four ratings (Again/Hard/Good/Easy) would be arbitrary.
- **Verdict:** **Phase 3.5/4 option.** Once per-question responses exist and each topic has enough questions, use `ts-fsrs` with default parameters to track retrievability per question or per topic, and schedule a review when predicted retrievability **at the exam date** falls below a target. [PROPOSED] Do not train parameters until there is real data.

### 3.6 MEMORIZE (Tabibian et al. 2019, PNAS)  [RESEARCHED]
- A mathematically derived optimal reviewing policy: with a memory model (e.g. exponential forgetting), the optimal review rate is given by the recall probability itself, trading recall against review cost. Validated on Duolingo data; code is listed as available.
- **Fit:** designed for open-ended retention with continuous-time sampling of review times, not for a fixed deadline and a small topic count. It also needs a fitted memory model.
- **Verdict:** **not for now.** Useful as theory behind FSRS-style "review when recall probability is low".

### 3.7 Interleaving — ordering practice  [RESEARCHED]
- Rohrer, Dedrick, Hartwig & Cheung (2020, *J. Educational Psychology*): preregistered cluster-randomized trial, 787 seventh-grade students in 54 classes; interleaved practice scored about 61% vs 37% for blocked on a test at least a month later (Cohen's d ≈ 0.83). Earlier classroom experiment (Rohrer, Dedrick & Burgess 2014): 72% vs 38%. An NBER study of a school program found a smaller short-term gain (about 0.28 SD). Interleaving took more class time.
- **Caveat:** school mathematics, grade 7; benefit per unit of study time not measured.
- **Verdict:** cheap rule: within a day, **mix topics from different syllabus sections** instead of long blocks of one topic, and make final review sessions mixed. [PROPOSED]

### 3.8 How others schedule revision (product patterns)  [RESEARCHED, low evidence]
- Backward planning from the exam date, with proportional time per subject and a buffer (several tools).
- Difficulty-weighted allocation: harder topics get more frequent reviews; mastered topics taper (Taskade/openeducat style tools).
- A **deadline parameter** that raises review frequency near the exam (CallSphere agent article).
- **Competitive-programming practice tools** (community Codeforces projects): identify weak tags, recommend problems within a window of the user's rating (e.g. within ±400 of max rating; a "boss" problem 300–500 above), use a Gaussian "rating fit" score. These are informal hobby projects with no published evaluation. They suggest a pattern for the **informatics** path once Cherenkov has problem difficulty ratings: *weak topic × difficulty fit* selects the next practice item. [PROPOSED]

### 3.9 Rejected approaches  [RESEARCHED + PROPOSED]
- **Deep Knowledge Tracing / Bayesian Knowledge Tracing:** Gervet et al. (2020, *J. Educational Data Mining*; from the earlier note, not re-checked) found simple logistic models best below roughly a million interactions, DKT best at large scale, BKT behind both. Cherenkov has near-zero interactions. Reject.
- **Reinforcement learning / bandits:** need large interaction volumes. Reject.
- **Integer programming / constraint solvers:** overkill for ≤ 60 topics per subject and an opacity cost for a student-facing tool. Reject.
- **LLM-generated schedules:** non-deterministic, costs money per regeneration, breaks the repo's pure-function test culture. If ever used, use it only to *explain* a deterministic plan. The Phase 3 doc already requires schema validation and a deterministic fallback.
- **Elo / item-response models (Pelánek 2016):** reasonable *later* once per-question responses and a decent bank exist.

---

## 4. Recommended design (composition of the methods above)  [PROPOSED]

Everything below is deterministic and testable as pure functions, in the style of `generatePlanItems`.

### 4.1 Inputs
- `subject`, `stage` ∈ {kabupaten/kota, provinsi, nasional}, `examDate`, `hoursPerWeek` (new user input), `today` (**must use the student's timezone**, Asia/Jakarta by default, not the server clock).
- Per topic: `selfRating` 1–5, quiz outcomes (per question: correct/incorrect, timestamp, question difficulty).
- Per topic metadata (to be authored): `effortMinutes` [PLACEHOLDER until authored], optional `sectionId` (already in the syllabus).

### 4.2 Step A — Self-rating → weak prior
Map rating *s* to a prior mean *p0* [PLACEHOLDER values]: 1→0.15, 2→0.35, 3→0.55, 4→0.75, 5→0.85. Use a **weak prior strength** of about 2 pseudo-questions (Beta(α = 2·p0, β = 2·(1−p0))) so two or three real answers outweigh the self-rating. Rationale: Section 3.2.

### 4.3 Step B — Confirmation quiz (diagnostic first)
- Week 1 prioritizes **confirmation quizzes**: first topics rated high but unverified (overconfidence risk), then topics rated middling. Topics rated very low need no quiz to know they need work, so quiz them last.
- Stop adaptively: if a section's first answers are all correct or all wrong, skip remaining topics in that section for now and carry the evidence over (ALEKS-style adaptivity, Section 3.1). [PROPOSED]
- Classify each topic **known / uncertain / not known** from the posterior (Step C).

### 4.4 Step C — Mastery estimate (Beta posterior)
Per topic: α ← α + correct answers weighted by recency, β ← β + incorrect answers weighted by recency (older outcomes decay, e.g. halve weight every 30 days [PLACEHOLDER]). Report posterior mean *p̂* and a lower credible bound *p_lower*. **No quiz answers ⇒ "unverified", not "failed".** Add a **per-student calibration offset**: average gap between self-rating-implied *p0* and observed *p̂* on confirmed topics, shrunk toward zero and applied to unverified topics. [PROPOSED]

### 4.5 Step D — Need and allocation
`target(stage)` is a mastery target that depends on the stage [PLACEHOLDER: kabupaten/kota 0.70, provinsi 0.80, nasional 0.85 — the user has not decided these]. Also pick the **question difficulty band** used for confirmation from the stage.
```
need(topic)     = max(0, target − p_lower)  + ε · uncertainty      // ε PLACEHOLDER
gain_per_hour   = need · learnability(p̂) / effortHours
```
`learnability(p̂)` is a simple bump that is low for near-mastered topics (nothing to gain) and for near-zero topics (RPL: not yet within reach) and highest in the middle [PLACEHOLDER shape]. Allocate hours by descending `gain_per_hour` until the hour budget is spent. Section 3.3 is the basis. Strong, confirmed topics get **review slots only** (Step E), not study time.

### 4.6 Step E — Backward scheduler with spacing
1. Reserve a final **buffer** (e.g. last 7 days [PLACEHOLDER]) for mixed review and a mock.
2. Convert `hoursPerWeek` to daily capacity (the Phase 3 doc leaves open whether it varies by weekday; pick one setting first).
3. Place week-1 confirmation quizzes, then study blocks in allocation order, respecting capacity.
4. For every topic, place reviews on the exam-anchored ladder (Section 3.4).
5. **If total required minutes exceed capacity, return `{ feasible: false, shortfallMinutes, suggestedCuts }`. Never silently cram.** (Current code does cram.)
6. Each `plan_item` stores a `reason`: `confirm`, `study`, `review`, `final_review`, `buffer`.

### 4.7 Step F — Interleave
After placing blocks, reorder within each day so no more than two consecutive blocks share a syllabus section. Final review sessions are mixed across sections.

### 4.8 Step G — Regeneration rules
- **Freeze** past days and completed items; only reschedule the future.
- Regenerate on explicit user action or after a quiz attempt (the Phase 3 doc leaves the trigger as an open question).
- Plan generation must be **idempotent**: same inputs ⇒ same output.

### 4.9 Rolling "today" list
Derive today's list from the plan: overdue items first, then today's items, then pull forward the next-highest `gain_per_hour` item if the student finishes early. The calendar is a view of the same data.

### 4.10 Informatics practice-problem selection (optional extension)
If problems with difficulty ratings exist: pick items in the student's weak topics with difficulty near their current ability plus a margin (pattern from Section 3.8, informal). Needs a problem bank first.

---

## 5. Integration with the repo

**Data work that must come first (blockers):**
1. **Per-question response table** (new), e.g. `quiz_question_responses` (attempt id, question id, correct, answered-at). Without it, Steps C–D are crude.
2. **Planner topics = syllabus topics.** Key by `(subject, syllabus topic id)`. Re-point `topics`/`plan_items` or add a mapping from editorials/materials to syllabus ids (they already reference them via `topic` / `syllabusTopic` frontmatter).
3. **Quiz bank:** at least a handful of questions per topic, with a **difficulty tag** (for stage targets) and rotation so retakes are not the same items. Currently about 3 topics have 1 question each.
4. **New student settings** (e.g. `user_planner_settings`): subject, stage, exam date, hours/week, timezone.
5. **Self-ratings table** (e.g. `topic_self_ratings`): user, subject, topic id, rating 1–5, rated-at.
6. **`plan_items` additions:** `reason`, `kind`, and keep `completedAt` across regeneration.
7. **Effort estimate per topic** (authoring task; a three-level field is enough to start).

**Code changes (when building):**
- New pure module (e.g. `lib/plan-scheduler.ts`) beside `plan-generator.ts`; keep `generatePlanItems` intact as the deterministic fallback (Phase 3 doc asks for a permanent fallback).
- New pure module for the mastery estimate (e.g. `lib/mastery.ts`); keep `deriveStatusFromAttempts` for display status.
- Fix `generateOrRegeneratePlanCore` so completed items are not wiped.
- Fix "today" to the student's timezone.
- Optional later: `pnpm add ts-fsrs` (check Node ≥ 20 on Vercel).

**Tests to write (repo uses Vitest, pure-function style):**
- every topic that needs work appears at least once; no day exceeds capacity; same inputs ⇒ same output; frozen/completed items never move; infeasible inputs are reported, not hidden; no more than two consecutive blocks from one section; mastery estimate: no data ⇒ "unverified"; self-rating prior is outweighed by a few real answers.
- A **simulation harness** (simulated learner with exponential forgetting) to compare: current even-spread, the Phase 3 priority-sort, and the new scheduler on mean retrievability at exam day, worst-topic retrievability, coverage, and fraction flagged infeasible. State clearly it tests logic, not real-world effectiveness.

**Known issues in the Phase 3 sketch (`docs/phase-3-architecture.md`):** its formula `priority = base_order_weight + weakness_weight × subject_multiplier` applies the subject multiplier to the weakness term only, it is a reorderer not a scheduler (each topic appears once, so it cannot place reviews), and it pushes mastered topics *later or out*, which is the opposite of what spacing research supports for an exam. With single-subject plans, a subject multiplier is no longer needed.

---

## 6. Open questions — answered 4 October 2026

Labels as above. "[DELEGATED]" = the user said "you decide"; these are my choices and the user may overturn them.

| # | Question | Resolution |
|---|---|---|
| 1 | Stage targets | **[USER-PROVIDED, qualitative]** A comparison table (OSK basic–intermediate material, short-answer + MCQ; OSP intermediate–advanced, short answer + essay; OSN very broad, long essays/case studies/practicum). It gives **no numeric mastery targets**, so the 0.70 / 0.80 / 0.85 values stay **[PLACEHOLDER]**. Mapped to code as a difficulty range per stage (`lib/osn-stages.ts`): OSN-K basic–intermediate, OSN-P intermediate–advanced, semifinal and final advanced only. **Tension flagged:** the table says material *scope* grows by stage, while the earlier decision (and the syllabus files) say one topic list for all stages. Implemented as one topic list, depth varies by difficulty. If OSN-K really excludes some topics, per-topic stage flags must be authored later. **Also:** essay/practicum questions cannot be auto-graded, so the confirmation quiz is multiple-choice only; essay-style practice is not modelled. |
| 2 | Hours | **[DELEGATED]** One number, `hours_per_week` (0 < h ≤ 80). A per-weekday schedule can be added later as another column. |
| 3 | Exam dates | **[USER-PROVIDED]** The site holds official dates. 2026: OSN-K 18–19 Jun, OSN-P 27–29 Jul, semifinal 12 Aug, final 14–20 Sep. **[USER-DECIDED assumption]** 2027 uses the same calendar dates; stored as `"projected"`, not official. Weekdays shift (e.g. 18 Jun 2027 is a Friday; 14–20 Sep 2027 runs Tue–Mon). Four stages exist in the schedule, not three: the semifinal was added. Someone must update `lib/osn-stages.ts` when the organiser announces 2027. Plans store `(stage, exam_year)`, not a date, so a corrected date reaches every plan. |
| 4 | Question bank | **[USER-DECIDED]** Editors will write the quizzes; every question carries a difficulty label. For now generated questions are allowed: 51 physics drafts (one per topic per difficulty) plus the two earlier example questions, all `status = draft`. Difficulty labels on them are the generator's estimate. Informatics (58 topics) and astronomy (20) have almost no questions. |
| 5 | Prerequisites | **[DELEGATED]** No prerequisite edges now; the design is revision-first, so they are not needed. Revisit only if the outer-fringe rule is wanted. |
| 6 | Physics source | **[USER-PROVIDED]** The physics syllabus comes from the official guidebook. Source label updated; edition/URL still unrecorded. The file's own note says the table has no per-level marks. |
| 7 | One subject per plan | **[DELEGATED]** Yes. `study_plans` is already one-plan-per-user, so switching subject replaces the plan. |
| 8 | Regeneration trigger | **[DELEGATED]** Explicit user action only for now (a button). Regeneration after quiz attempts reshuffles the plan under the student; revisit once the scheduler exists. Completed items must be kept on regeneration (existing bug, not yet fixed). |
| 9 | Self-rating scale | **[DELEGATED]** 1–5 kept, enforced by a database check. The rating→prior mapping stays **[PLACEHOLDER]**. |

## 7. Sources and how much to trust them

| Source | Used for | Trust |
|---|---|---|
| Doignon & Falmagne, *Knowledge Spaces and Learning Spaces* — arxiv.org/abs/1511.06757 | KST, fringe, ALEKS | Peer-level, authoritative |
| ALEKS Corp., *A practical perspective on KST: ALEKS and its data* (mheducation.com PDF) | ALEKS in practice | Vendor paper; read as such |
| *Performance of Two Adaptive Assessment Engines*, EDM 2022 industry track (educationaldatamining.org/EDM2022/proceedings/2022.EDM-industry-track.109) | ALEKS adding a neural network to KST assessment | Peer-reviewed, vendor-authored |
| Metcalfe & Kornell (2005), *A Region of Proximal Learning model of study time allocation*; Metcalfe (2009), *Metacognitive judgments and control of study* (PMC2742428) | RPL | Peer-reviewed; vocabulary tasks |
| Self-assessment papers: BMC Medical Education 2024 (doi 10.1186/s12909-024-06121-7); Frontiers in Psychology 2024 (doi 10.3389/fpsyg.2024.1252520); IJRES field experiment (ijres.net/index.php/ijres/article/view/1510) | Weak, biased self-assessment | Peer-reviewed; university samples |
| Cepeda, Vul, Rohrer, Wixted & Pashler (2008), *Psychological Science* 19(11) | Spacing vs test delay | Peer-reviewed; **figures taken from earlier note, not re-checked this session** |
| Rohrer et al. (2020), *J. Educational Psychology* 112(1), 40–52; Rohrer et al. (2014), *Psychonomic Bull. & Rev.* (doi 10.3758/s13423-014-0588-3) | Interleaving | Peer-reviewed RCT/experiment (summaries via Matuschak notes, Learning Scientists) |
| Tabibian et al. (2019), PNAS 116(10), 3988–3993, doi 10.1073/pnas.1815156116 (PMC6410796) | MEMORIZE | Peer-reviewed |
| `ts-fsrs` GitHub README (github.com/open-spaced-repetition/ts-fsrs); docs at open-spaced-repetition.github.io/ts-fsrs | FSRS library facts | Maintainer docs; MIT licence shown |
| Anki forums: "How do I use FSRS for exam?" (forums.ankiweb.net/t/how-do-i-use-fsrs-for-exam/43631) and related threads | Community exam practice | **Forum posts, anecdotal** |
| Picmonic help article; openeducat study-schedule tool; iatrox spacing guide; CallSphere article | Product patterns | **Vendor/blog, low evidence** |
| Codeforces community blogs (AlgoRadar, CP Compass, CP Trainer, Drill/Boss) | Informatics practice-selection patterns | **Hobby projects, no published evaluation** |
| Gervet et al. (2020) *JEDM* 12(3); Pelánek (2016) *Computers & Education* 98; Corbett & Anderson (1994); Piech et al. (2015) | KT comparisons, Elo | From earlier note; **not re-checked this session** |

**Limits of this research:** I read abstracts and excerpts returned by search, not full papers. I did not run the repo or its tests. The design in Section 4 is my composition of the above and **has not been validated on any real student data**; every number marked [PLACEHOLDER] must be replaced or confirmed by the user.

---

## 8. Suggested order of work for a future agent

Status on 4 October 2026: steps 1–3 done (see below).

1. ~~Resolve open questions~~ — done (Section 6).
2. **Data layer.** Patch 1 (`phase3-data-layer.patch`): syllabus-keyed `topics`; `quiz_questions.key/difficulty/status`; `quiz_question_responses`; `user_planner_settings`; `topic_self_ratings`; `plan_items.kind/reason`; stage config; quiz bank and seeds. Patch 2 (`phase3-wiring-and-mastery.patch`) wires it: quiz submission now writes one response row per answered question (same transaction as the attempt); regeneration keeps completed items and does not reschedule their topics; `generatePlan` uses the student's calendar day (settings time zone, else Asia/Jakarta); server actions `savePlannerSettings` and `saveTopicSelfRatings`. **Still not done:** no UI calls the new actions; subject switching only returns `subjectChanged: true` (nothing deletes or regenerates the old plan); `plan_items.kind/reason` are never set (the old generator leaves the default `study`); `topic.effort` exists as an optional type field with no values.
3. ~~Build `lib/mastery.ts`~~ — **done in patch 2** (Steps A and C). Beta posterior, self-rating as a weak prior (strength 2), recency decay (30-day half-life), 10th/90th-percentile bounds, status `unverified | known | uncertain | not_known`, shrunk per-student calibration offset applied only to unanswered topics. All parameters are **[PLACEHOLDER]** in `MASTERY_PARAMS`. It does not weigh answers by difficulty, and there is no database loader yet that gathers a student's answers and ratings into its input.
4. Build **`lib/plan-scheduler.ts`** (Steps D–G) with the property tests above; keep the old generator as fallback.
5. Build the **simulation harness** and compare against the baseline and the Phase 3 sketch before wiring the UI.
6. Build UI: onboarding (self-rating) → confirmation quiz → plan; show self-rating vs quiz result; show infeasibility with suggested cuts; show each item's `reason`; label draft questions as drafts.
7. Only then consider `ts-fsrs` (Section 3.5) once there are hundreds of graded responses.

**Never do:** silently compress an infeasible plan; wipe completed items on regeneration; use the server clock for "today"; present placeholder numbers as validated; add an LLM to generate the schedule; claim the spacing ratios are optimal for olympiad problem solving.

---

## 9. Glossary

- **OSN / OSN-K / OSN-P:** Olimpiade Sains Nasional; K = kabupaten/kota (city/regency) stage, P = provinsi (province) stage, then nasional.
- **Syllabus topic:** one entry in `lib/syllabus/data/*.ts`; the planner's scheduling unit.
- **Outer fringe (KST):** topics the student does not know yet but is ready to learn given what they know.
- **Retrievability:** probability of recalling an item right now (FSRS term).
- **Desired retention (FSRS):** target recall probability the scheduler aims for.
- **Interleaving:** mixing different topic types within practice instead of doing them in blocks.
- **Posterior (Beta):** updated belief about the success rate after seeing right/wrong answers.
- **Infeasible plan:** required study minutes exceed available minutes before the exam.
