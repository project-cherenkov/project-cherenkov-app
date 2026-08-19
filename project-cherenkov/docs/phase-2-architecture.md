# Phase 2 architecture — study planner (not built)

Phase 1 (this repo, as scaffolded) is a public, no-login editorial archive.
Nothing below is implemented — this is a plan to build against later, so a
Phase 1 decision doesn't quietly close off Phase 2. Nothing here should
change how Phase 1 works.

## What Phase 2 adds

Optional accounts, and a study planner for working through informatics,
physics, and astronomy material ahead of the TKA/UTBK exam, tracking
progress per topic. The archive itself stays free and login-free — accounts
only unlock the planner layer on top of it.

## Stack (already reserved in package.json / .env.example)

- **Neon** — serverless Postgres. Pick this over a traditional host because
  Vercel's preview deployments can each get a branched database for free.
- **Drizzle ORM** — schema-as-TypeScript, migrations via `drizzle-kit`.
- **Better Auth** — session + OAuth handling. Provider(s) TBD (open question
  in the build spec, §12) — email/password plus one OAuth provider is a
  reasonable default once that's decided.

## Sketch: data model

Not a final schema — enough shape to plan routes and UI against.

```
users            id, email, name, created_at, (Better Auth manages this table)
topics           id, subject, chapter, title, order — mirrors the archive's
                 subject/principle taxonomy so planner progress can link
                 back to relevant editorials
user_progress    user_id, topic_id, status (not_started | in_progress | done),
                 updated_at
study_plans      user_id, target_exam_date, generated_at
plan_items       plan_id, topic_id, scheduled_for, completed_at
```

`topics` deliberately does NOT duplicate editorial content — it references
editorial slugs so a planner topic can deep-link into the Phase 1 archive
rather than forking the content.

## Sketch: routes

```
/[locale]/login                     — Better Auth sign-in
/[locale]/signup                    — Better Auth sign-up
/[locale]/planner                   — overview: progress across all 3 subjects
/[locale]/planner/[subject]/[chapter]  — per-chapter progress + linked editorials
/api/auth/[...all]                  — Better Auth's catch-all handler
```

## Open questions before building

- OAuth provider(s) — spec §12 flags this as undecided.
- Whether `study_plans` is a single always-current plan per user, or
  versioned/re-generatable ones.
- Whether progress is self-reported (checkbox) or inferred from
  quiz/exercise completion — the build spec doesn't say, and it changes the
  schema meaningfully (self-reported needs far less).
