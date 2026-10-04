// Phase 3: the planner schedules SYLLABUS topics, so planner `topics` rows are
// derived from lib/syllabus rather than from editorials (see
// lib/seed/derive-topics.ts for the older, editorial-driven derivation).
// Pure — the DB work lives in scripts/seed-topics.ts.
//
//   chapter / title <- the topic's section and own name, Indonesian (the
//                      site's default locale; the English names stay in the
//                      syllabus and can be looked up through syllabusTopicId)
//   order           <- position within the subject, following the syllabus
//                      file's own order (theory sections only). Unlike the
//                      old publication-date order this IS the syllabus order
//   editorialSlug   <- the earliest-published editorial that points at this
//                      topic through its `syllabusTopic` frontmatter, if any.
//                      topics.editorial_slug holds one link, so any further
//                      editorials on the same topic are not linked here.
import type { Subject } from "../subjects";
import type { SubjectSyllabus } from "../syllabus/types";

export interface SyllabusEditorialLike {
  subject: Subject;
  slug: string;
  publishedAt: string;
  syllabusTopic?: string | undefined;
}

export interface DerivedSyllabusTopic {
  subject: Subject;
  syllabusTopicId: string;
  sectionId: string;
  chapter: string;
  title: string;
  order: number;
  editorialSlug: string | null;
}

export function deriveSyllabusTopics(
  syllabi: SubjectSyllabus[],
  editorials: SyllabusEditorialLike[],
): DerivedSyllabusTopic[] {
  // (subject, topicId) -> primary editorial slug
  const primary = new Map<string, SyllabusEditorialLike>();
  for (const editorial of editorials) {
    if (!editorial.syllabusTopic) continue;
    const key = `${editorial.subject}\u0000${editorial.syllabusTopic}`;
    const current = primary.get(key);
    if (
      !current ||
      editorial.publishedAt < current.publishedAt ||
      (editorial.publishedAt === current.publishedAt &&
        editorial.slug < current.slug)
    ) {
      primary.set(key, editorial);
    }
  }

  const derived: DerivedSyllabusTopic[] = [];
  for (const syllabus of syllabi) {
    let order = 0;
    for (const section of syllabus.sections) {
      if (section.part !== "theory") continue;
      for (const topic of section.topics) {
        derived.push({
          subject: syllabus.subject,
          syllabusTopicId: topic.id,
          sectionId: section.id,
          chapter: section.name.id,
          title: topic.name.id,
          order: order++,
          editorialSlug:
            primary.get(`${syllabus.subject}\u0000${topic.id}`)?.slug ?? null,
        });
      }
    }
  }
  return derived;
}
