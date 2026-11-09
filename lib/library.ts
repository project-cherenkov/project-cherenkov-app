// Joins the syllabus (structured data) with the two content collections that
// hang off it — materials and editorials — into the shape the syllabus and
// materials pages render. Pure functions over plain arrays (no Velite import)
// so it can be unit-tested without a content build.
import type {
  SubjectSyllabus,
  SyllabusSection,
  SyllabusSubtopic,
  SyllabusTopic,
} from "./syllabus";

export interface MaterialRef {
  subject: string;
  slug: string;
  title: string;
  // A topic id OR a subtopic id (they share one namespace per subject).
  topic: string;
}

export interface EditorialRef {
  subject: string;
  slug: string;
  title: string;
  // A topic id OR a subtopic id.
  syllabusTopic?: string;
}

export interface SubtopicEntry {
  subtopic: SyllabusSubtopic;
  material?: MaterialRef;
  editorials: EditorialRef[];
}

// `material` and `editorials` are the ones that point at the TOPIC ITSELF.
// Content that points at one of its subtopics lives in `subtopics`, so nothing
// is counted or listed twice.
export interface TopicEntry {
  topic: SyllabusTopic;
  material?: MaterialRef;
  editorials: EditorialRef[];
  subtopics: SubtopicEntry[];
}

export interface SectionEntry {
  section: SyllabusSection;
  topics: TopicEntry[];
}

export interface SubjectCoverage {
  sections: SectionEntry[];
  // Top-level topics only, matching the source syllabus.
  topicCount: number;
  subtopicCount: number;
  // Every material and editorial attached anywhere in the subject, whether it
  // points at a topic or at a subtopic.
  materialCount: number;
  editorialCount: number;
  // Topics with at least one material on the topic itself or on any of its
  // subtopics. This (not materialCount) is the numerator for "N of M topics
  // covered": three materials under one topic still cover one topic.
  coveredTopicCount: number;
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
  let subtopicCount = 0;
  let materialCount = 0;
  let editorialCount = 0;
  let coveredTopicCount = 0;

  // If two materials claim one id, the alphabetically first slug wins so the
  // result is stable; content-integrity.test.ts rejects this case for real
  // content anyway.
  const materialFor = (id: string) =>
    subjectMaterials
      .filter((m) => m.topic === id)
      .sort((a, b) => a.slug.localeCompare(b.slug))[0];
  const editorialsFor = (id: string) =>
    subjectEditorials.filter((e) => e.syllabusTopic === id);

  const sections = syllabus.sections.map((section): SectionEntry => {
    const topics = section.topics.map((topic): TopicEntry => {
      const material = materialFor(topic.id);
      const related = editorialsFor(topic.id);
      const subtopics = (topic.subtopics ?? []).map((subtopic): SubtopicEntry => {
        const subMaterial = materialFor(subtopic.id);
        const subRelated = editorialsFor(subtopic.id);
        subtopicCount += 1;
        if (subMaterial) materialCount += 1;
        editorialCount += subRelated.length;
        return { subtopic, material: subMaterial, editorials: subRelated };
      });

      topicCount += 1;
      if (material) materialCount += 1;
      editorialCount += related.length;
      if (material || subtopics.some((entry) => entry.material)) coveredTopicCount += 1;
      return { topic, material, editorials: related, subtopics };
    });
    return { section, topics };
  });

  return {
    sections,
    topicCount,
    subtopicCount,
    materialCount,
    editorialCount,
    coveredTopicCount,
  };
}

export interface CoverageMatch {
  section: SectionEntry;
  topic: TopicEntry;
  // Set when the id was a subtopic's.
  subtopic?: SubtopicEntry;
}

// Finds the entry for a topic OR subtopic id.
export function findCoverageEntry(
  coverage: SubjectCoverage,
  id: string,
): CoverageMatch | undefined {
  for (const section of coverage.sections) {
    for (const topic of section.topics) {
      if (topic.topic.id === id) return { section, topic };
      const subtopic = topic.subtopics.find((entry) => entry.subtopic.id === id);
      if (subtopic) return { section, topic, subtopic };
    }
  }
  return undefined;
}

// Previous/next material within one syllabus section, in syllabus order. The
// order walks each topic and then its subtopics, so a topic's own material is
// followed by its subtopics' materials before the next topic's. `id` may be a
// topic or a subtopic id.
export function getSectionNeighbours(
  coverage: SubjectCoverage,
  id: string,
): { previous?: MaterialRef; next?: MaterialRef } {
  const match = findCoverageEntry(coverage, id);
  if (!match) return {};
  const ordered: { id: string; material: MaterialRef }[] = [];
  for (const topic of match.section.topics) {
    if (topic.material) ordered.push({ id: topic.topic.id, material: topic.material });
    for (const sub of topic.subtopics) {
      if (sub.material) ordered.push({ id: sub.subtopic.id, material: sub.material });
    }
  }
  const index = ordered.findIndex((entry) => entry.id === id);
  if (index === -1) return {};
  return {
    previous: ordered[index - 1]?.material,
    next: ordered[index + 1]?.material,
  };
}
