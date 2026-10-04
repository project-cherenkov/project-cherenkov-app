// Seeds quiz_questions from the quiz bank (lib/quiz-bank). Run after
// scripts/seed-topics.ts — questions attach to syllabus-keyed topics rows.
//
// Idempotent: questions are upserted on their stable `key`, so re-running
// updates them instead of duplicating them. The bank is validated first and
// nothing is written if it has problems.
//
// Questions that predate the bank (no key) are not touched. They are counted
// and reported; pass --prune-legacy to delete them.
import { db } from "../lib/db";
import { getBankCoverage, QUIZ_BANK, validateQuizBank } from "../lib/quiz-bank";
import {
  countKeylessQuestions,
  deleteKeylessQuestions,
  seedQuizBank,
} from "../lib/seed/seed-db";

async function main() {
  const problems = validateQuizBank(QUIZ_BANK);
  if (problems.length > 0) {
    console.error(`Quiz bank has ${problems.length} problem(s); nothing seeded:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const report = await seedQuizBank(db, QUIZ_BANK);
  console.log(`Seeded ${report.upserted} quiz question(s) from the bank.`);
  if (report.skippedNoTopic.length > 0) {
    console.warn(
      `Skipped ${report.skippedNoTopic.length} question(s) with no topics row ` +
        "(run scripts/seed-topics.ts first): " +
        report.skippedNoTopic.join(", "),
    );
  }

  const withoutQuestions = getBankCoverage().filter(
    (row) => row.counts.basic + row.counts.intermediate + row.counts.advanced === 0,
  );
  console.log(
    `${withoutQuestions.length} syllabus topic(s) still have no questions at all.`,
  );
  const drafts = QUIZ_BANK.filter((q) => q.status === "draft").length;
  console.log(`${drafts} of ${QUIZ_BANK.length} bank question(s) are unreviewed drafts.`);

  const keyless = await countKeylessQuestions(db);
  if (keyless > 0) {
    if (process.argv.includes("--prune-legacy")) {
      const removed = await deleteKeylessQuestions(db);
      console.log(`Deleted ${removed} legacy question(s) that had no key.`);
    } else {
      console.warn(
        `${keyless} legacy question(s) have no key and were left as they are ` +
          "(they may duplicate bank questions). Re-run with --prune-legacy to delete them.",
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("seed-quiz-questions failed:", error);
    process.exit(1);
  });
