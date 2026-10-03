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
  SyllabusTopic,
} from "./types";

export type {
  LocalizedText,
  SubjectSyllabus,
  SyllabusLocale,
  SyllabusSection,
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
  topic: SyllabusTopic;
}

export function getTopicLocation(
  subject: string,
  topicId: string,
): LocatedTopic | undefined {
  const syllabus = getSyllabus(subject);
  if (!syllabus) return undefined;
  for (const section of syllabus.sections) {
    const found = section.topics.find((topic) => topic.id === topicId);
    if (found) return { section, topic: found };
  }
  return undefined;
}

export function getTopicCount(subject: Subject): number {
  return SYLLABI[subject].sections.reduce(
    (total, section) => total + section.topics.length,
    0,
  );
}

// Anchors used by the syllabus page, and by links that deep-link into it.
export const sectionAnchor = (sectionId: string) => `section-${sectionId}`;
export const topicAnchor = (topicId: string) => `topic-${topicId}`;

// Options for Keystatic's topic <select>s. Labelled in English, with the
// section as a prefix, so authors can tell "Divide and conquer" (recursion)
// from "Divide and conquer" (problem-solving strategy).
export function topicSelectOptions(
  subject: Subject,
): { label: string; value: string }[] {
  return SYLLABI[subject].sections.flatMap((section) =>
    section.topics.map((topic) => ({
      label: `${section.name.en} › ${topic.name.en}`,
      value: topic.id,
    })),
  );
}
