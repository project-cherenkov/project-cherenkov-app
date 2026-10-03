// Joins the syllabus (structured data) with the two content collections that
// hang off it — materials and editorials — into the shape the syllabus and
// materials pages render. Pure functions over plain arrays (no Velite import)
// so it can be unit-tested without a content build.
import type {
  SubjectSyllabus,
  SyllabusSection,
  SyllabusTopic,
} from "./syllabus";

export interface MaterialRef {
  subject: string;
  slug: string;
  title: string;
  topic: string;
}

export interface EditorialRef {
  subject: string;
  slug: string;
  title: string;
  syllabusTopic?: string;
}

export interface TopicEntry {
  topic: SyllabusTopic;
  material?: MaterialRef;
  editorials: EditorialRef[];
}

export interface SectionEntry {
  section: SyllabusSection;
  topics: TopicEntry[];
}

export interface SubjectCoverage {
  sections: SectionEntry[];
  topicCount: number;
  materialCount: number;
  editorialCount: number;
}

export function buildSubjectCoverage(
  syllabus: SubjectSyllabus,
  materials: MaterialRef[],
  editorials: EditorialRef[],
): SubjectCoverage {
  const subjectMaterials = materials.filter((m) => m.subject === syllabus.subject);
  const subjectEditorials = editorials.filter(
    (e) => e.subject === syllabus.subject && e.syllabusTopic,
  );

  let topicCount = 0;
  let materialCount = 0;
  let editorialCount = 0;

  const sections = syllabus.sections.map((section): SectionEntry => {
    const topics = section.topics.map((topic): TopicEntry => {
      // If two materials claim one topic, the alphabetically first slug wins
      // so the result is stable; content-integrity.test.ts rejects this case
      // for real content anyway.
      const material = subjectMaterials
        .filter((m) => m.topic === topic.id)
        .sort((a, b) => a.slug.localeCompare(b.slug))[0];
      const related = subjectEditorials.filter((e) => e.syllabusTopic === topic.id);

      topicCount += 1;
      if (material) materialCount += 1;
      editorialCount += related.length;
      return { topic, material, editorials: related };
    });
    return { section, topics };
  });

  return { sections, topicCount, materialCount, editorialCount };
}

// Previous/next material within one syllabus section, in syllabus order.
export function getSectionNeighbours(
  coverage: SubjectCoverage,
  topicId: string,
): { previous?: MaterialRef; next?: MaterialRef } {
  const sectionEntry = coverage.sections.find((entry) =>
    entry.topics.some((t) => t.topic.id === topicId),
  );
  if (!sectionEntry) return {};
  const withMaterial = sectionEntry.topics.filter((t) => t.material);
  const index = withMaterial.findIndex((t) => t.topic.id === topicId);
  if (index === -1) return {};
  return {
    previous: withMaterial[index - 1]?.material,
    next: withMaterial[index + 1]?.material,
  };
}
