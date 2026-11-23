# Quiz authoring

Quiz questions are content like editorials and materials: one file per question, edited in Keystatic, reviewed in a pull request, and synced into the database that students read. Git is the source of truth.

## Where things live

| What | Where |
|---|---|
| Questions | `content/quiz/<subject>/<question-id>.yaml`, edited in Keystatic under **Quiz: Informatics / Physics / Astronomy** |
| Loading and validation | `lib/quiz-bank/` (`load.ts`, `index.ts`, `files.ts`) |
| Git-to-database sync rules | `lib/quiz-bank/sync.ts` (run by `pnpm db:seed:quiz`) |
| What the database serves, coverage, archive switch | `/keystatic/quiz-bank` (verified editors only) |

## Writing a question

1. In Keystatic, open the subject's quiz collection and create an entry.
2. **Question ID** is permanent and has the form `<subject>.<topic>.<difficulty>.<number>`, for example `physics.vectors.basic.2`. The number only has to be unused for that topic and difficulty. It must agree with the Topic and Difficulty you pick; the test suite checks this. It is the file name and what the database matches on, so never reuse an ID for a different question and never renumber.
3. Pick the **syllabus topic** (planner topics only) and the **difficulty**. OSN stages draw from different difficulty ranges.
4. Write the prompt (`$inline$` and `$$display$$` math render with KaTeX for students), at least two **different** choices, tick **exactly one** as correct, and write the explanation: why the right choice is right and, ideally, which mistake each wrong choice reflects.
5. Leave **Review status** as `draft`. Optionally fill **Author** and **Source** (say whether the question is original, adapted, or from a past paper).

Keystatic saves to a `keystatic/…` branch, so every change goes through a pull request.

## Review

A question stays `draft` until someone **other than the author** has recomputed the answer key and changed the status to `reviewed`. Students only receive active, reviewed questions, and only reviewed ones count toward coverage.

`pnpm test` loads every question through Keystatic's own reader and fails the pull request if a question has no correct choice or several, an ID that disagrees with its file name, a key that disagrees with its topic or difficulty, duplicate or empty choices, or an unknown topic. Make that check required in branch protection if you want it to block merges.

## Getting it to students

Merging does **not** change the database. After a quiz change lands on `main`, run the sync against the production database:

```
DATABASE_URL=... pnpm db:seed:quiz
```

The sync never reads from `pnpm build`, so a preview deployment can never write to the production database. It is idempotent and prints what it did. Its rules:

- Git wins for content: a keyed question that differs from its file is overwritten from the file.
- Nothing is deleted. `quiz_question_responses` cascades on delete, so deleting a row would erase students' answer history. A question whose file is removed is **archived** instead.
- Archiving is one-way. A question is archived if its file says `Archived` or the database already has it archived. The sync never restores. Restore on `/keystatic/quiz-bank`, or untick Archived in the file only after restoring there.
- Rows with an `admin.<uuid>` key (made in the old database-only editor) or no key are not managed and are left as they are.

## Emergency: a wrong question is live

Open `/keystatic/quiz-bank`, find the question, and press **Archive now**. It takes effect immediately, with no merge or sync. Then fix the file, get it reviewed, and press **Restore** once the corrected version has been synced. Because the sync never restores, a re-sync in between cannot bring the bad version back.

## One-time migration of database-only questions

```
pnpm quiz:export-db            # dry run: prints old key -> new key
pnpm quiz:export-db --apply    # writes content/quiz files, then renames the keys
```

Files are written first and the database keys are renamed only after every file exists, so a failure leaves the database untouched. Each row keeps its id, so attempts, responses and missed-question history stay attached. Commit the new files, open a pull request, then run `pnpm db:seed:quiz`.
