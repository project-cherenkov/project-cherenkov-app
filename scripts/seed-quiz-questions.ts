// Syncs content/quiz (edited in Keystatic) into quiz_questions. Run after
// scripts/seed-topics.ts — questions attach to syllabus-keyed topics rows.
//
//   pnpm db:seed:quiz        only this script
//   pnpm db:seed             regenerates content, seeds topics, then this
//
// Git is the source of truth for a keyed question's content: a question that
// differs from its file is overwritten from the file. Nothing is ever deleted
// (student history hangs off the rows); a question whose file is gone is
// archived. A question archived in the database stays archived (restore it on
// /keystatic/quiz-bank). Rows with an "admin.<uuid>" key or no key are not in
// git and are left alone — run scripts/export-db-quiz-questions.ts to move
// them. The bank is validated first and nothing is written if it has problems.
//
// The script reads DATABASE_URL from the process environment (a .env file
// alone does not make it available to direct tsx scripts).
import { db } from "../lib/db";
import { getBankCoverage, validateQuizBank } from "../lib/quiz-bank";
import { loadQuizBank } from "../lib/quiz-bank/load";
import {
  countKeylessQuestions,
  deleteKeylessQuestions,
  syncQuizBank,
} from "../lib/seed/seed-db";

async function main() {
  const { bank, problems: loadProblems } = await loadQuizBank();
  const problems = [...loadProblems, ...validateQuizBank(bank)];
  if (problems.length > 0) {
    console.error(`Quiz content has ${problems.length} problem(s); nothing synced:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const report = await syncQuizBank(db, bank);
  console.log(
    `Quiz sync: ${report.inserted} added, ${report.updated} updated, ${report.unchanged} unchanged.`,
  );
  if (report.archivedMissing.length > 0) {
    console.warn(
      `Archived ${report.archivedMissing.length} question(s) whose file no longer exists ` +
        "(rows are never deleted, so student history is kept): " +
        report.archivedMissing.join(", "),
    );
  }
  if (report.databaseOnlyArchived.length > 0) {
    console.warn(
      `${report.databaseOnlyArchived.length} question(s) are archived in the database but not in their file ` +
        "(the sync never restores). Restore them on /keystatic/quiz-bank, or tick Archived in the file so git matches: " +
        report.databaseOnlyArchived.join(", "),
    );
  }
  if (report.skippedNoTopic.length > 0) {
    console.warn(
      `Skipped ${report.skippedNoTopic.length} question(s) with no topics row ` +
        "(run scripts/seed-topics.ts first): " +
        report.skippedNoTopic.join(", "),
    );
  }

  const withoutQuestions = getBankCoverage(bank).filter(
    (row) => row.counts.basic + row.counts.intermediate + row.counts.advanced === 0,
  );
  console.log(`${withoutQuestions.length} syllabus topic(s) still have no questions at all.`);
  const drafts = bank.filter((q) => q.status === "draft").length;
  console.log(`${drafts} of ${bank.length} question(s) are unreviewed drafts.`);

  if (report.unmanaged > 0) {
    console.warn(
      `${report.unmanaged} database row(s) are not in git (admin.* keys or no key) and were left as they are. ` +
        "Run `pnpm quiz:export-db` to move the admin.* ones into content/quiz.",
    );
  }

  const keyless = await countKeylessQuestions(db);
  if (keyless > 0 && process.argv.includes("--prune-legacy")) {
    const removed = await deleteKeylessQuestions(db);
    console.log(`Deleted ${removed} legacy question(s) that had no key.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("seed-quiz-questions failed:", error);
    process.exit(1);
  });
