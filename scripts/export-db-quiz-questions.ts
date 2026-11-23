// One-time migration: moves quiz questions that exist ONLY in the database
// (made in the old admin page, key "admin.<uuid>") into git as
// content/quiz/<subject>/<key>.yaml, and renames each row's key to match, so
// its id, student answers and misses stay attached.
//
//   pnpm quiz:export-db            dry run: prints the plan, writes nothing
//   pnpm quiz:export-db --apply    writes the files, then renames the keys
//
// Order matters and is deliberate: files are written first and the keys are
// renamed only after every file exists, so a failure leaves the database
// untouched. Commit the new files, open a PR, then run `pnpm db:seed:quiz`.
// Needs DATABASE_URL in the process environment.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { eq, like } from "drizzle-orm";
import { db } from "../lib/db";
import { quizQuestions, topics } from "../lib/db/schema";
import { planDbExport, type DbOnlyQuestionRow } from "../lib/quiz-bank/export";
import { quizFilePath, serializeQuizFile } from "../lib/quiz-bank/files";
import { loadQuizBank } from "../lib/quiz-bank/load";

async function main() {
  const apply = process.argv.includes("--apply");

  const { bank, problems } = await loadQuizBank();
  if (problems.length > 0) {
    console.error("content/quiz has problems; fix them first:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const rows = (await db
    .select({
      id: quizQuestions.id,
      key: quizQuestions.key,
      subject: topics.subject,
      syllabusTopicId: topics.syllabusTopicId,
      prompt: quizQuestions.prompt,
      choices: quizQuestions.choices,
      correctChoiceIndex: quizQuestions.correctChoiceIndex,
      explanation: quizQuestions.explanation,
      difficulty: quizQuestions.difficulty,
      status: quizQuestions.status,
      archived: quizQuestions.archived,
    })
    .from(quizQuestions)
    .innerJoin(topics, eq(quizQuestions.topicId, topics.id))
    .where(like(quizQuestions.key, "admin.%"))) as DbOnlyQuestionRow[];

  if (rows.length === 0) {
    console.log("No database-only (admin.*) questions found. Nothing to export.");
    return;
  }

  // Every key already taken: files in git plus every key in the database.
  const taken = new Set(bank.map((q) => q.key));
  for (const row of await db.select({ key: quizQuestions.key }).from(quizQuestions)) {
    if (row.key) taken.add(row.key);
  }

  const plan = planDbExport(rows, taken);
  console.log(`${plan.exports.length} question(s) to export, ${plan.skipped.length} skipped.`);
  for (const item of plan.exports) {
    console.log(`  ${item.oldKey}  ->  ${item.question.key}`);
  }
  for (const item of plan.skipped) {
    console.warn(`  SKIPPED ${item.key ?? item.rowId}: ${item.reason}`);
  }
  if (!apply) {
    console.log("Dry run. Re-run with --apply to write the files and rename the keys.");
    return;
  }

  const root = process.cwd();
  for (const item of plan.exports) {
    const path = join(root, quizFilePath(item.question.subject, item.question.key));
    if (existsSync(path)) throw new Error(`Refusing to overwrite ${path}`);
  }
  for (const item of plan.exports) {
    const path = join(root, quizFilePath(item.question.subject, item.question.key));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, serializeQuizFile(item.question), { flag: "wx" });
  }
  for (const item of plan.exports) {
    await db.update(quizQuestions).set({ key: item.question.key }).where(eq(quizQuestions.id, item.rowId));
  }
  console.log(
    `Wrote ${plan.exports.length} file(s) and renamed their keys. Review and commit content/quiz, open a PR, then run \`pnpm db:seed:quiz\`.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("export-db-quiz-questions failed:", error);
    process.exit(1);
  });
