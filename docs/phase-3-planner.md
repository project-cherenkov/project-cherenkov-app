# Phase 3 planner (OSN path) — how it works now

Research and reasoning: the context-transfer document (`docs/planner-context-transfer.md`). This file describes what is built. Code is the source of truth.

## Flow the student sees (`/planner`)
1. **Settings** — subject, OSN stage, exam year, hours per week (`user_planner_settings`).
2. **Self-ratings** — 1–5 per syllabus topic (`topic_self_ratings`). Unrated = "no opinion".
3. **Plan** — generated from settings + ratings + quiz answers. Shows today's list,
   overdue and "up next" items, coming weeks, per-topic status, and an honest banner when
   the hours are not enough. Study/review sessions are ticked off by hand; quizzes complete
   their confirmation item automatically.

## Pipeline (all pure and deterministic except the DB reads)
`plan-state.ts` (load + mastery) → `plan-scheduler.ts` (schedule) → `plan-service.ts` (write).
`plan-view.ts` builds the page data; `plan-db.ts` holds the real queries.

- **Mastery** (`mastery.ts`): Beta posterior, self-rating as weak prior, 30-day decay,
  answers counted only at the stage's difficulty range.
- **Scheduler**: confirmation quizzes first (high self-rating first, very low last), then
  study ranked by gain per hour (Region of Proximal Learning), exam-anchored spaced
  reviews, a pre-exam buffer with a final mixed pass, interleaving within a day.
- **Feasibility** means every quiz and study session found a slot. Skipped *reviews* are
  reported (`skippedReviewCount`) but do not make a plan infeasible.
- **Regeneration** keeps completed items, never reschedules their study, and uses the
  student's calendar day (settings time zone, default Asia/Jakarta). It runs on explicit
  action only; the page shows a banner when settings or quizzes changed since.
- Switching subject: the old plan is replaced after the student rates the new subject's topics.
- The Phase 2 even-spread generator (`plan-generator.ts`, `generatePlan`) is kept as the
  deterministic fallback; the page no longer calls it.

## Everything marked [PLACEHOLDER]
`MASTERY_PARAMS` (mastery.ts), `SCHEDULER_PARAMS` (plan-scheduler.ts), `STAGES[*].masteryTarget`
(osn-stages.ts), and the 2027 dates (projected from 2026). None is calibrated on real students.
`scripts/simulate-planner.ts` compares the schedulers on *simulated* learners — a logic
check only, not evidence that students learn more.

## Deploying
1. Apply database migrations: `pnpm db:migrate` (runs `drizzle/0000_wonderful_meteorite.sql`, which includes the full schema and Phase 3 tables).
2. `pnpm db:seed` — loads syllabus topics and the quiz bank. Without it the planner says topics are not loaded.
3. Set `ADMIN_EMAILS` — authorizes the CMS write surface and scene builder, and decides who gets the **Primus Inter Pares** role on `/account`.

## Known gaps
- Topic `effort` is not authored anywhere, so every topic counts as medium.
- Informatics and astronomy have almost no quiz questions; those topics cannot be confirmed yet.
- The quiz dialog shows all of a topic's questions, not only the stage's difficulty range
  (only in-range answers feed the estimate).
- Essay/practicum questions cannot be auto-graded and are not modelled.
