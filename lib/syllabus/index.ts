// Single entry point for the syllabus data layer. Pure TypeScript — no Velite,
// no React — so it is safe to import from keystatic.config.ts (which is
// bundled into the browser), from Server Components, and from tests alike.
import { SUBJECTS, isKnownSubject, type Subject } from "../subjects";
import { astronomy } from "./data/astronomy";
import { informatics } from "./data/informatics";
import { physics } from "./data/physics";
import type {
  LocalizedText,
  SubjectSyllabus,
  SyllabusLocale,
  SyllabusSection,
  SyllabusSubtopic,
  SyllabusTopic,
} from "./types";

export type {
  LocalizedText,
  SubjectSyllabus,
  SyllabusLocale,
  SyllabusSection,
  SyllabusSubtopic,
  SyllabusTopic,
} from "./types";

export const SYLLABI: Record<Subject, SubjectSyllabus> = {
  informatics,
  physics,
  astronomy,
};

export function getSyllabus(subject: string): SubjectSyllabus | undefined {
  return isKnownSubject(subject) ? SYLLABI[subject] : undefined;
}

export function getAllSyllabi(): SubjectSyllabus[] {
  return SUBJECTS.map((subject) => SYLLABI[subject]);
}

// Names are stored in both site locales; fall back to Indonesian (the site's
// default locale) for any locale added later without a translation.
export function localize(text: LocalizedText, locale: string): string {
  return text[locale as SyllabusLocale] ?? text.id;
}

export interface LocatedTopic {
  section: SyllabusSection;
  // Always the top-level topic. When the id given was a subtopic's, this is
  // that subtopic's PARENT and `subtopic` is the subtopic itself, so callers
  // that only know topics (the planner, quiz bank, review pages) keep working
  // and can ignore `subtopic`.
  topic: SyllabusTopic;
  subtopic?: SyllabusSubtopic;
}

// Finds a topic OR a subtopic by id (they share one namespace per subject).
export function getTopicLocation(
  subject: string,
  topicId: string,
): LocatedTopic | undefined {
  const syllabus = getSyllabus(subject);
  if (!syllabus) return undefined;
  for (const section of syllabus.sections) {
    for (const topic of section.topics) {
      if (topic.id === topicId) return { section, topic };
      const subtopic = topic.subtopics?.find((entry) => entry.id === topicId);
      if (subtopic) return { section, topic, subtopic };
    }
  }
  return undefined;
}

// The top-level topic id for a topic-or-subtopic id, or undefined when the id
// is unknown. Use this wherever data keyed by TOPIC (planner rows, the quiz
// bank, mastery) has to be joined with content that may point at a subtopic.
export function resolveTopicId(
  subject: string,
  topicOrSubtopicId: string,
): string | undefined {
  return getTopicLocation(subject, topicOrSubtopicId)?.topic.id;
}

// Top-level topics only: subtopics are not counted here (see getSubtopicCount),
// because topics are what the planner schedules and what the source lists.
export function getTopicCount(subject: Subject): number {
  return SYLLABI[subject].sections.reduce(
    (total, section) => total + section.topics.length,
    0,
  );
}

export function getSubtopicCount(subject: Subject): number {
  return SYLLABI[subject].sections.reduce(
    (total, section) =>
      total +
      section.topics.reduce((sub, topic) => sub + (topic.subtopics?.length ?? 0), 0),
    0,
  );
}

// Anchors used by the syllabus page, and by links that deep-link into it.
export const sectionAnchor = (sectionId: string) => `section-${sectionId}`;
export const topicAnchor = (topicId: string) => `topic-${topicId}`;

// Options for Keystatic's topic <select>s. Labelled in English, with the
// section as a prefix, so authors can tell "Divide and conquer" (recursion)
// from "Divide and conquer" (problem-solving strategy). A topic is followed
// directly by its subtopics ("Section › Topic › Subtopic"), so the list stays
// in syllabus order and a subtopic is never mistaken for a topic.
export function topicSelectOptions(
  subject: Subject,
): { label: string; value: string }[] {
  return SYLLABI[subject].sections.flatMap((section) =>
    section.topics.flatMap((topic) => [
      {
        label: `${section.name.en} › ${topic.name.en}`,
        value: topic.id,
      },
      ...(topic.subtopics ?? []).map((subtopic) => ({
        label: `${section.name.en} › ${topic.name.en} › ${subtopic.name.en}`,
        value: subtopic.id,
      })),
    ]),
  );
}
