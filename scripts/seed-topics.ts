// DB-002: derives `topics` rows from existing editorial frontmatter so
// `editorial_slug` links are real, not invented. Only reads
// content/editorials/ (via lib/content.ts, which reads Velite's build
// output) — never writes to it (DB-002 constraint).
//
// Precondition: `pnpm generate` (Velite build) must already have run, since
// lib/content.ts resolves the generated #content module — the same
// "generate before #content resolves" precondition
// .github/workflows/ci.yml's own comment documents for lint/typecheck.
// `pnpm db:seed` runs `pnpm generate` first for exactly this reason.
//
// Relative imports throughout (not the @/ tsconfig alias) — this script
// runs directly under `tsx`, not through Next's bundler, and relative
// imports don't depend on tsx resolving tsconfig `paths` the same way
// Next.js does. UNVERIFIED: whether `tsx` can run this script at all in a
// real environment could not be checked here (no network access to install
// dependencies) — see the final implementation report's Remaining Risks.
import { getAllEditorials } from "../lib/content";
import { deriveTopicsFromEditorials } from "../lib/seed/derive-topics";
import { db } from "../lib/db";
import { topics } from "../lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const editorials = getAllEditorials();
  const derived = deriveTopicsFromEditorials(editorials);

  if (derived.length === 0) {
    console.log("No editorials found in content/editorials/ — nothing to seed.");
    return;
  }

  for (const topic of derived) {
    await db
      .insert(topics)
      .values(topic)
      .onConflictDoUpdate({
        target: topics.editorialSlug,
        targetWhere: sql`${topics.editorialSlug} is not null`,
        set: {
          subject: topic.subject,
          chapter: topic.chapter,
          title: topic.title,
          order: topic.order,
        },
      });
  }

  console.log(
    `Seeded ${derived.length} topic(s) from ${editorials.length} editorial(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("seed-topics failed:", error);
    process.exit(1);
  });
