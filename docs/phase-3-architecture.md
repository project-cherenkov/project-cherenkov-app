# Phase 3 architecture — adaptive scheduling (not implemented)

Phase 2 (this repo, as built) gives every user a single, evenly-distributed
study plan generated once from a target exam date (`lib/plan-generator.ts`)
and progress derived from quiz attempts (`lib/planner.ts`). Nothing below is
implemented — this is a plan to build against later, so a Phase 2 decision
doesn't quietly close off Phase 3. Nothing here changes how Phase 1 or
Phase 2 works.

## 1. Phase 3 scope: rule-based adaptive scheduling

The evenly-spread plan Phase 2 generates treats every topic identically —
it doesn't know that a user is struggling with one subject, breezing
through another, or has more study time on some days than others. Phase 3's
core scope is a **deterministic, rule-based** rescheduling pass that uses
signal Phase 2 already produces:

- **Study hours per day** — a new user-supplied input (not collected
  today), used to bound how many topics can realistically land on a given
  day, rather than Phase 2's uniform per-day bucketing.
- **Favourite-subject weighting** — a new user preference (e.g. a 0-2x
  multiplier per subject) that shifts relative scheduling frequency without
  changing which topics exist.
- **Quiz-derived mastery data** — `lib/planner.ts`'s `getAllProgress` and
  `deriveStatusFromAttempts` already compute per-topic status
  (`done` / `in_progress` / `not_started`) and have every raw
  `quiz_attempts` score available. Phase 3 would extend this into a
  weakness signal — e.g. topics with a low most-recent score, or topics
  retaken multiple times without reaching mastery, get pulled earlier and
  repeated more often; topics already `done` get pushed later or dropped
  from the active rotation.

### Sketch of the rule (not a final schema)

A possible deterministic scoring function, run once per regeneration
(mirroring `generateOrRegeneratePlanCore`'s existing update-or-create
shape, not a continuous background job):

```
priority(topic) = base_order_weight(topic.order)
                 + weakness_weight(most_recent_score_or_null)
                 * subject_multiplier(user_preference[topic.subject])
```

Topics would then be sorted by descending `priority` before being fed into
something like today's `generatePlanItems` day-bucketing, rather than the
`order`-only sort that function uses now. This keeps the "evenly distribute
across the window, compress if needed" mechanics from Phase 2 intact and
only changes *which order* topics are consumed in — a smaller, more
contained change than it might first sound, but still a real behavior
change worth its own design pass, not a two-line patch.

This would likely need at least one new stored input (study hours/day,
subject weighting) — plausibly a small `user_preferences` table, or columns
added to a per-user settings row, if one exists by then. Not specified
further here; that's exactly the kind of schema decision Phase 3's own
build spec should make with a real repository in front of it, the same way
this repo's Phase 2 spec did for `study_plans`/`plan_items`.

## 2. Optional enhancement: LLM-generated scheduling

An LLM could generate a more nuanced schedule than a fixed rule — reasoning
qualitatively about topic difficulty, spacing repetition, or phrasing
encouragement alongside the plan. This is explicitly **Optional**, and a
genuine departure from this codebase's otherwise deterministic,
build-time-validated design (Velite's content schemas, build-time KaTeX
rendering, `generatePlanItems`'s pure deterministic function) — not a
default choice, and not something to reach for before the rule-based
version above has shipped and been found insufficient.

Real trade-offs, named plainly:

- **Non-deterministic output.** Two generations from the same inputs can
  differ. Every required test in this repo's Phase 2 work
  (`generatePlanItems`'s determinism test, `plan-generator.test.ts`) relies
  on pure, deterministic functions — an LLM-backed path can't offer that
  same guarantee and would need a fundamentally different testing strategy
  (structural/schema assertions on output shape, not exact-value assertions
  on content).
- **Schema validation before trust.** An LLM's output must be validated
  against `plan_items`'s real shape (valid `topic_id`s that actually exist,
  `scheduled_for` dates inside the intended window, every topic still
  covered exactly once) before it's allowed to become real rows — the same
  posture this repo already takes toward external/untrusted input
  elsewhere (`lib/quiz-scoring.ts` never trusts a client-supplied score).
  A generation that fails validation must not partially apply.
- **Added latency.** A plan generation goes from a synchronous DB
  read/write (Phase 2, `generatePlan`) to a network round-trip to an LLM
  provider — the "Generate plan" button's UX needs a real loading/pending
  state, not the fire-and-refresh pattern `GeneratePlanForm` uses today.
- **Per-generation cost.** Unlike Phase 2's free, deterministic
  computation, every regeneration has a real per-call cost — worth capping
  (e.g. a minimum interval between regenerations, or an explicit
  confirmation step) rather than letting a user regenerate arbitrarily
  often.
- **Fallback path required.** A failed or malformed generation must fall
  back to the deterministic rule-based plan (§1) rather than leaving the
  user with no plan or a partially-written one — the rule-based version
  isn't just a stepping stone to the LLM version, it's also its safety net.

## 3. Open questions before building

Honestly incomplete — Phase 3 is not fully decided:

- Is study-hours-per-day a fixed daily number, or does it vary by day of
  week (e.g. more on weekends)? Changes whether it's a single user setting
  or a small per-weekday structure.
- Where does subject-weighting preference get set — onboarding, a settings
  page, or inferred implicitly from which subjects a user quizzes on most?
  Each implies different UI and a different trust level for the signal.
- Does adaptive scheduling replace Phase 2's plan generation outright, or
  run as a distinct "smart mode" a user opts into, leaving the deterministic
  even-spread plan as a permanent fallback option?
- Should weakness-driven rescheduling only take effect on explicit
  regeneration (matching Phase 2's existing update-or-create-on-request
  model), or should a sufficiently bad quiz attempt trigger an automatic
  partial reschedule? The latter changes `syncPlanItemCompletion`'s
  record-only role into something that also mutates future schedule rows,
  which is a meaningfully bigger change than it sounds.
- If the LLM enhancement (§2) is ever built, which provider/model, and
  should its use be opt-in per user given the added cost?
