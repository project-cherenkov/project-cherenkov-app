# Database migrations

**Rule: every migration is created by `pnpm db:generate`. Never create a migration file, a snapshot or a journal entry by hand.** This applies to humans and AI agents alike. You may edit the SQL that `generate` wrote (for a data backfill, say); you may not write the file yourself.

## Why

Drizzle keeps two records, and they do different jobs:

| Record | Files | Used by |
| --- | --- | --- |
| What to apply | `drizzle/NNNN_name.sql` and `drizzle/meta/_journal.json` | `pnpm db:migrate` runs the journal entries newer than the last one recorded in the database's `__drizzle_migrations` table |
| What to compare against | `drizzle/meta/NNNN_snapshot.json` (a picture of the whole schema after that migration) | `pnpm db:generate` diffs `lib/db/schema.ts` against the **latest** snapshot and writes SQL for the difference |

`migrate` never reads snapshots, so a hand-written migration applies fine. But the next `generate` then compares the schema to a stale picture and writes DDL for changes that are already applied. That DDL fails or conflicts if it runs. This happened once: snapshots stopped at `0005` while `0006`-`0013` were written by hand, and it was repaired with the no-op baseline `0014_schema_baseline` (see "History").

## Workflow

1. Edit `lib/db/schema.ts`.
2. Run `pnpm db:generate --name=short_snake_case_description`.
3. Read the SQL it wrote. If the change needs a data backfill or other custom SQL, edit **that file's body only**. Do not touch `drizzle/meta/*`.
4. Run `pnpm db:check` and `pnpm test`.
5. Commit the `.sql`, the new `meta/NNNN_snapshot.json` and the updated `meta/_journal.json` **together**, in one commit with the schema change.
6. Apply with `DATABASE_URL=... pnpm db:migrate` before deploying code that needs the change. Back up (or use a Neon branch) first if the migration touches existing rows.

If `generate` asks an interactive question such as "is this column renamed or new?", **stop and ask a human** rather than guessing: a wrong answer can turn a rename into a drop-and-create and delete data. For a column that is really renamed, answer "rename", and check that the SQL has `RENAME` and no `DROP`.

If you need a migration that changes no schema (a data fix), use `pnpm db:generate --custom --name=...`. Note that this copies the previous snapshot, which is correct because the schema did not change.

## What enforces it

- **`pnpm test`**: `lib/db/migrations-integrity.test.ts` needs no database. It fails when a `.sql` file and its journal entry do not match, tags or timestamps are out of order, a migration after the frozen hand-written range has no snapshot, the snapshot chain (`prevId`) is broken, or the baseline migration contains anything but `SELECT 1`.
- **`pnpm db:check`** (also a CI step): runs `drizzle-kit check`, then `drizzle-kit generate`, and fails if `generate` wants to create anything: `schema.ts` changed without a migration, or a migration does not match the schema. It restores `drizzle/` afterwards whether it passes or fails and needs no database connection.
- **Branch protection**: make the CI job required, or both checks only advise.

Two branches that each add a migration collide on the same number and snapshot. `drizzle-kit check` reports this. Rebase one branch, delete its generated files and run `pnpm db:generate` again. Never renumber by hand.

## What they cannot catch

- The checks prove the snapshot matches the schema; they cannot prove edited SQL is correct. Review the SQL body by eye. For migrations that move or backfill data, add a test that applies the chain to a real Postgres engine (see `lib/db/quiz-question-types-migration.test.ts`, which uses PGlite).
- A deliberately forged snapshot that matches the schema would pass. Code review (a code owner on `drizzle/` is a good idea) is the remaining defence.

## History

- `0000`-`0005` were generated normally.
- `0006`-`0013` were written by hand and have no snapshots. That range is frozen in the integrity test; never extend it.
- `0014_schema_baseline` records one snapshot of the schema as it stood after `0013`. Its SQL is an intentional no-op (`SELECT 1;`): every change it describes was already applied by `0006`-`0013`. Running `pnpm db:migrate` only records it as applied. From `0014` on, `generate` diffs against a correct snapshot.
