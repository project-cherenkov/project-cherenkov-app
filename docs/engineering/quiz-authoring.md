# Quiz authoring

Quiz questions are content like editorials and materials: one file per question, edited in Keystatic, reviewed in a pull request, and synced into the database that students read. Git is the source of truth.

There are **four deterministic question types**. All are graded by the server against an answer key that never reaches the browser before submission. There is no free-text, essay or manually graded type.

## Where things live

| What | Where |
|---|---|
| Questions | `content/quiz/<subject>/<question-id>.yaml`, edited in Keystatic under **Quiz: Informatics / Physics / Astronomy** |
| Type model, grading, response validation | `lib/quiz-types.ts` (pure, no server imports) |
| Loading, parsing, serialising, validation | `lib/quiz-bank/` (`load.ts`, `index.ts`, `files.ts`, `types.ts`) |
| Git-to-database sync rules | `lib/quiz-bank/sync.ts` (run by `pnpm db:seed:quiz`) |
| Server scoring and submission | `lib/quiz-scoring.ts`, `lib/quiz-actions.ts` |
| Student UI | `components/quiz/` (`quiz-dialog.tsx`, `question-input.tsx`) |
| Missed-question review and retry | `lib/misses*.ts`, `components/planner/miss-card.tsx` |
| What the database serves, coverage, archive switch | `/keystatic/quiz-bank` (verified editors only) |

## Common fields

Every file has these. The Question ID equals the file name without `.yaml`; the question type is **not** part of the ID.

```yaml
questionId: <subject>.<topic-id>.<difficulty>.<n>
topic: <planner topic id>
difficulty: basic            # basic | intermediate | advanced
status: draft                # draft | reviewed
archived: false
questionType: single_choice  # single_choice | multiple_select | true_false_set | numeric_response
prompt: "<self-contained prompt>"
explanation: "<type-appropriate explanation>"
author: "<who wrote it>"
source: "original"           # or the exact book section and printed pages
```

- **Question ID** is permanent: `physics.vectors.basic.2`. The number only has to be unused for that topic and difficulty, and it must agree with the topic and difficulty. Never reuse an ID for a different question and never renumber.
- `$inline$` and `$$display$$` math render with KaTeX for students.
- **`author` and `source` are required for every new-format question** (any file that has a `questionType` line). They are checked by `pnpm test`, not by the Keystatic form (see "Keystatic limits" below). Legacy files without them are exempt, and no author is ever invented for them.

## The four types

### `single_choice`

One correct option; at least two distinct, non-empty options.

```yaml
questionType: single_choice
choices:
  - text: "<distractor>"
    correct: false
  - text: "<correct option>"
    correct: true
  - text: "<distractor>"
    correct: false
```

Graded correct only when the submitted option index equals the server-side correct index.

### `multiple_select`

The student ticks every correct option. At least **three** distinct options, at least **two** correct and at least **one** incorrect. Do not use "all of the above" / "none of the above" (the validator rejects them).

```yaml
questionType: multiple_select
choices:
  - text: "<option>"
    correct: true
  - text: "<option>"
    correct: false
  - text: "<option>"
    correct: true
```

Graded by **exact set match**, order-insensitive: correct only when the submitted set contains every correct index and no incorrect one. All-or-nothing; no partial credit.

### `true_false_set`

**3 to 5** distinct, self-contained, independently judgeable statements. The student marks each True or False.

```yaml
questionType: true_false_set
statements:
  - text: "<statement 1>"
    isTrue: true
  - text: "<statement 2>"
    isTrue: false
  - text: "<statement 3>"
    isTrue: true
```

`isTrue` says whether the proposition itself is factually true; it is the answer key, not a preselected response. Graded by **exact boolean-vector match** in statement order. All-or-nothing. The explanation should say why each statement is true or false, and which misconception each false statement reflects. A question is only submitted when every statement has been marked.

### `numeric_response`

One finite number in a stated unit.

```yaml
questionType: numeric_response
numericAnswer:
  value: 2.35
  tolerance: 0.01
  unit: "au"
```

These are schema placeholders, not an example question. The prompt must tell the student to enter the final value in the displayed unit; the student does not type the unit. `value` and `tolerance` must be finite and `tolerance >= 0` (absolute, in `unit`). `unit` is non-empty.

Graded correct exactly when `|submitted - value| <= tolerance`. The comparison allows about 1e-15 *relative* floating-point slack, purely so that a value exactly at the boundary is accepted (in binary, `2.36 - 2.35` is `0.010000000000000231`, which would otherwise fail a tolerance of `0.01`). The slack is far below any authorable tolerance. Students may type `2.35` or `2,35`, a Unicode minus, or scientific notation (`1.5e3`). Never use a wide tolerance to hide an ambiguous question.

## Legacy questions

A file with **no `questionType` line** is a legacy single-choice question (top-level `choices` with exactly one `correct: true`). It stays valid as it is: no content rewrite is needed, its ID and key never change, and it is written back without a `questionType` line, so loading and re-saving it produces no diff. It is exempt from the `author`/`source` requirement. As soon as it is edited in Keystatic and gains a `questionType`, it is a new-format question and needs both.

## Writing a question

1. In Keystatic, open the subject's quiz collection and create an entry.
2. Set the **Question ID**, **syllabus topic**, **difficulty** and **Question type**.
3. Fill in **only the section for that type** (Answer choices, Statements, or Numeric answer) and leave the others empty. A question that fills in another type's section fails `pnpm test`.
4. Write the explanation for learning, not just confirmation.
5. Fill in **Author** and **Source**. Leave **Review status** as `draft`.

Keystatic saves to a `keystatic/…` branch, so every change goes through a pull request.

### Keystatic limits

- **All type sections are always visible** in the Keystatic form. Keystatic's `fields.conditional` can only store a nested `{discriminant, value}` object, which can neither read the legacy files nor produce the flat YAML above, so the schema is flat. Mistakes are caught by the loader/validator instead.
- **Author and Source are not marked required in the form.** Keystatic's reader enforces required fields while reading, so a required field would make every legacy file (which has neither) unreadable. The requirement is enforced by `validateQuizBank` in `pnpm test`.
- Saving a question in Keystatic writes empty defaults for the unused sections (`statements: []`, an empty `numericAnswer`); the loader treats those as absent.

## Review

A question stays `draft` until someone **other than the author** has recomputed the answer key and changed the status to `reviewed`. Students only receive active, reviewed questions, and only reviewed ones count toward coverage.

`pnpm test` loads every question through Keystatic's own reader and fails the pull request if:

- the ID disagrees with the file name, the key disagrees with the topic or difficulty, or the topic is unknown;
- the prompt or explanation is empty;
- a type's rules are broken: wrong number of choices or correct choices, a multiple-select with fewer than two correct or no incorrect options, "all/none of the above", a true/false set with fewer than 3 or more than 5 statements, duplicate or empty choices/statements, or a numeric answer with a non-finite value, a negative or non-finite tolerance, or an empty unit;
- the question has fields belonging to another type;
- a new-format question has no `author` or `source`.

Make that check required in branch protection if you want it to block merges.

## How grading and privacy work

- The browser receives only the question type, the prompt and display content (choices, statements, or the numeric unit). It never receives correct flags, truth values, the expected number or the tolerance before submission.
- On submit the server loads the answer key by question ID, checks the response has **the question's type** and a valid shape, and scores it. A response with the wrong type, an unknown question ID, a duplicate question, an out-of-range or duplicate index, a wrong-length or non-boolean true/false vector, or a non-finite number is rejected. The client cannot choose the scoring mode, and any client-sent score, correctness flag, key or user ID is ignored.
- Only answered questions get a response-history row. The topic score keeps its existing meaning: correct questions divided by **all** served questions for the topic, so unanswered questions are not wrong answers but do count in the denominator. Multiple-select and true/false are all-or-nothing, so mastery and misses stay question-level.
- After submission the student sees, for each **answered** question only, whether it was right, the type-appropriate correct answer and the explanation.
- The miss-review page shows the student's actual earlier answer for every type, and reveals the correct answer only after a retry or an explicit "show the answer" on a question they have already got wrong.

## Database model

`quiz_questions` has `question_type`, `content` (jsonb, public display data) and `answer_key` (jsonb, server-only), plus a check constraint that both jsonb values carry the same `type` as the column. `quiz_question_responses` and `question_retries` have a `response` jsonb column holding the type-neutral submitted answer; `selected_choice_index` is still written for single-choice answers and is the only record on rows from before migration `0013_quiz_question_types.sql`. Readers go through `storedResponse()` in `lib/quiz-types.ts`.

The old `quiz_questions.choices` and `correct_choice_index` columns are **deprecated**: nullable, no longer read or written by the app, and stale after a question is re-synced. A later migration can drop them.

## Getting it to students

Merging does **not** change the database. After a quiz change lands on `main`, apply any new migration, then sync:

```
DATABASE_URL=... pnpm db:migrate     # once, for 0013_quiz_question_types.sql
DATABASE_URL=... pnpm db:seed:quiz
```

Migrate **before** deploying code that reads the new columns. The sync never reads from `pnpm build`, so a preview deployment can never write to the production database. It is idempotent and prints what it did. Its rules:

- Git wins for content: a keyed question that differs from its file (type, content, answer key, prompt, difficulty, status, explanation) is overwritten from the file.
- Nothing is deleted. `quiz_question_responses` cascades on delete, so deleting a row would erase students' answer history. A question whose file is removed is **archived** instead.
- Archiving is one-way. A question is archived if its file says `Archived` or the database already has it archived. The sync never restores. Restore on `/keystatic/quiz-bank`, or untick Archived in the file only after restoring there.
- Changing an existing question's type or answer key rewrites what students' old responses meant. Prefer a new question ID (and archive the old one) over changing the type of a question that has history.
- Rows with an `admin.<uuid>` key (made in the old database-only editor) or no key are not managed and are left as they are.

## Emergency: a wrong question is live

Open `/keystatic/quiz-bank`, find the question, and press **Archive now**. It takes effect immediately, with no merge or sync. Then fix the file, get it reviewed, and press **Restore** once the corrected version has been synced. Because the sync never restores, a re-sync in between cannot bring the bad version back.

## One-time migration of database-only questions

```
pnpm quiz:export-db            # dry run: prints old key -> new key
pnpm quiz:export-db --apply    # writes content/quiz files, then renames the keys
```

Files are written first and the database keys are renamed only after every file exists, so a failure leaves the database untouched. Each row keeps its id, so attempts, responses and missed-question history stay attached. The old admin page only made single-choice questions, so they are written as legacy files. Commit the new files, open a pull request, then run `pnpm db:seed:quiz`.
