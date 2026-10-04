// Seeds the planner's `topics` table from the SYLLABUS (lib/syllabus), one row
// per theory topic, keyed by (subject, syllabus_topic_id). Replaces the older
// editorial-driven seed (lib/seed/derive-topics.ts): the planner schedules
// syllabus topics, and an editorial is only attached to a topic when its
// `syllabusTopic` frontmatter points there.
//
// Existing rows that were derived from an editorial are adopted in place, not
// duplicated (see lib/seed/seed-db.ts). Rows that cannot be matched to a
// syllabus topic are left untouched; they keep syllabus_topic_id = null and
// the planner must ignore them.
//
// Precondition: `pnpm generate` (Velite build) must already have run, since
// lib/content.ts resolves the generated #content module. `pnpm db:seed` runs
// `pnpm generate` first for exactly this reason.
//
// Relative imports throughout (not the @/ alias) — this runs directly under
// `tsx`, not through Next's bundler.
import { getAllEditorials } from "../lib/content";
import { db } from "../lib/db";
import { deriveSyllabusTopics } from "../lib/seed/derive-syllabus-topics";
import { seedSyllabusTopics } from "../lib/seed/seed-db";
import { getAllSyllabi } from "../lib/syllabus";

async function main() {
  const derived = deriveSyllabusTopics(getAllSyllabi(), getAllEditorials());
  const report = await seedSyllabusTopics(db, derived);

  console.log(
    `Seeded ${report.upserted} syllabus topic(s)` +
      (report.adopted > 0
        ? `; adopted ${report.adopted} existing editorial-derived row(s)`
        : "") +
      ".",
  );
  for (const slug of report.editorialLinksSkipped) {
    console.warn(
      `Editorial "${slug}" is already attached to a different topics row — ` +
        "its syllabus topic was left without an editorial link.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("seed-topics failed:", error);
    process.exit(1);
  });
