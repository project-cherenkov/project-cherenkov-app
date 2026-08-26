// DB-002: pure derivation logic, separated from scripts/seed-topics.ts's DB
// I/O so it's directly unit-testable (DB-002's required test: "one topics
// row per real editorial file found") without a live database or a Velite
// build.
//
// CONTENT-MODEL GAP FOUND WHILE IMPLEMENTING (flagged per the Feature
// Worker Prompt's "Handling Unexpected Problems" — not silently guessed):
// existing editorial frontmatter (velite.config.ts) has no `chapter` or
// `order` field. This project deliberately indexes its archive by
// principle/errorType, not by chapter (project brief, spec §1) — "chapter"
// is a planner-specific curriculum concept DB-002 introduces, with no
// existing source of truth in content/editorials/. Conservative default,
// flagged for the project owner to override with real curriculum data
// later:
//   - chapter      <- editorial.principle (closest existing analog to a
//                      topic/grouping label already in the data)
//   - order        <- position within its subject, oldest-to-newest by
//                      publishedAt (a natural syllabus progression, not a
//                      real curriculum order)
//   - editorialSlug <- editorial.slug (real, not invented — DB-002's actual
//                      acceptance criterion)
export interface EditorialLike {
  subject: "informatics" | "physics" | "astronomy";
  slug: string;
  title: string;
  principle: string;
  publishedAt: string;
}

export interface DerivedTopic {
  subject: EditorialLike["subject"];
  chapter: string;
  title: string;
  order: number;
  editorialSlug: string;
}

export function deriveTopicsFromEditorials(
  editorials: EditorialLike[],
): DerivedTopic[] {
  const bySubject = new Map<EditorialLike["subject"], EditorialLike[]>();
  for (const editorial of editorials) {
    const list = bySubject.get(editorial.subject) ?? [];
    list.push(editorial);
    bySubject.set(editorial.subject, list);
  }

  const derived: DerivedTopic[] = [];
  for (const [subject, list] of bySubject) {
    const ordered = [...list].sort(
      (a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt),
    );
    ordered.forEach((editorial, index) => {
      derived.push({
        subject,
        chapter: editorial.principle,
        title: editorial.title,
        order: index,
        editorialSlug: editorial.slug,
      });
    });
  }

  return derived;
}
