# Agent instructions

> Status: current. This directory contains maintained working instructions for AI agents and human contributors. Read the repository's current documentation, schemas and tests alongside these files.

These documents describe responsibilities and workflows. They do not replace the application schema, runtime validation, tests, or project-level decisions.

## Which instructions to use

| Task | Instructions |
| --- | --- |
| Create a new editorial | [Writer Agent Instructions](CHERENKOV-WRITER-AGENT-INSTRUCTIONS-v2.1-2026-11-21.md) |
| Create a new material | [Writer Agent Instructions](CHERENKOV-WRITER-AGENT-INSTRUCTIONS-v2.1-2026-11-21.md) |
| Revise an existing editorial or material | [Revision Agent Instructions](CHERENKOV-REVISION-AGENT-INSTRUCTIONS-v1.1-2026-11-21.md), together with the [Writer Agent Instructions](CHERENKOV-WRITER-AGENT-INSTRUCTIONS-v2.1-2026-11-21.md) |
| Author, review or validate a quiz question | [Quiz authoring](../engineering/quiz-authoring.md), together with the current [OSN stage calibration](../engineering/osn-stage-calibration.md) |
| Change the database schema or add a migration | [Database migrations](../engineering/database-migrations.md) |

The Revision Agent Instructions are a companion to the Writer Agent Instructions: the writer document defines the quality and file-format standards; the revision document adds diagnosis, scope and change-control procedures.

## Authority and conflict resolution

Use this order when sources disagree:

1. **Application code, schemas and tests** determine what the application accepts, validates and does.
2. **Current project documentation** records the owner's product and editorial decisions.
3. **Agent instructions** define how an agent should carry out an authorised task within those constraints.
4. **A task prompt** scopes one assignment and may add task-specific constraints, but does not silently change application invariants or durable project policy.

An agent must report a conflict rather than silently choosing whichever instruction is more convenient. In particular, distinguish technical schema capability from an agent's narrower authoring permissions. A field being accepted by the schema does not mean every agent is authorised or expected to set it; an agent restriction does not mean the application schema rejects it.

## Database migrations: never by hand

Every migration is created with `pnpm db:generate`. Do not create or edit files in `drizzle/meta/`, and do not create a `.sql` migration or a journal entry yourself; you may edit the body of a generated `.sql` file when a data backfill is needed. If `drizzle-kit` asks an interactive question (for example whether a column was renamed), stop and ask a human. Run `pnpm db:check` and `pnpm test` before committing; both fail on a hand-written or mismatched migration. See [Database migrations](../engineering/database-migrations.md).

## Snapshot limitations

The current instruction files are versioned snapshots dated 2026-11-21. Earlier versions are retained as historical snapshots.

- The Writer Agent Instructions include syllabus and content-registry snapshots. Treat them as orientation, not live registries. Verify topic IDs, existing content, frontmatter rules and visualization capabilities against the current repository before authoring whenever repository access is available.
- The Revision Agent Instructions include starting notes about specific pieces in Section 4. Those notes describe the state at the time of writing; they are not diagnoses of the current files. Always inspect the current target and make a fresh diagnosis. The rest of the revision methodology remains the reusable workflow unless superseded by a newer version.
- The version and date in each filename are intentional. Do not silently overwrite a versioned standard. When a standard changes materially, create a new version, update this index and record what changed.

## Version history

- **Writer v2.1 (2026-11-21):** makes visualization mandatory for published materials and editorials; establishes explanation-first authoring and separates conceptual visualization in materials from investigative visualization in editorials.
- **Revision v1.1 (2026-11-21):** adds explicit review criteria against decorative or spectacle-led visualization and checks that explanations stand independently.
- **Writer v2.0 and Revision v1.0 (2026-11-17):** retained as historical snapshots.

## Maintenance

When updating these instructions:

- Check the current code, schemas, tests and project documentation first.
- Keep durable policy separate from dated snapshots and one-off task prompts.
- Update this index and any cross-references in `docs/README.md`.
- Do not add one-time execution prompts, temporary plans or generated patches as current agent standards. Preserve them in a dated review or history record only when they have continuing audit value.
