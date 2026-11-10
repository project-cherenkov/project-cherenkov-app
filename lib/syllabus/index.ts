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
  SyllabusSource,
  SyllabusSubtopic,
  SyllabusTopic,
} from "./types";

export type {
  LocalizedText,
  SourceVerification,
  SubjectSyllabus,
  SyllabusLocale,
  SyllabusSection,
  SyllabusSource,
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

// --- Sources -----------------------------------------------------------------

export function getSource(
  syllabus: SubjectSyllabus,
  sourceId: string,
): SyllabusSource | undefined {
  return syllabus.sources.find((entry) => entry.id === sourceId);
}

// The source the planner, quiz bank and mastery estimates are built on.
export function getPrimarySource(syllabus: SubjectSyllabus): SyllabusSource {
  return syllabus.sources[0]!;
}

// The language of a topic's OFFICIAL wording: that of its first source. The
// other language in `name` is an unofficial gloss.
export function topicLanguage(
  syllabus: SubjectSyllabus,
  topic: SyllabusTopic,
): SyllabusLocale {
  const first = topic.in[0] ? getSource(syllabus, topic.in[0]) : undefined;
  return first?.language ?? getPrimarySource(syllabus).language;
}

// Sources that list a section: its topics' sources, or its own for a practical
// section. In registry order so the output is stable.
export function sectionSourceIds(
  syllabus: SubjectSyllabus,
  entry: SyllabusSection,
): string[] {
  const found = new Set<string>(entry.in ?? []);
  for (const topic of entry.topics) for (const id of topic.in) found.add(id);
  return syllabus.sources.map((source) => source.id).filter((id) => found.has(id));
}

// What a badge needs to say about one topic. Generated from membership alone,
// so adding a source to the registry needs no change here.
export interface TopicSourceCoverage {
  // Sources that list the topic, in registry order.
  listedIn: SyllabusSource[];
  // True when the topic is in the primary source.
  inPrimary: boolean;
  // True when the subject has only one source, so there is nothing to compare.
  singleSource: boolean;
}

export function describeTopicCoverage(
  syllabus: SubjectSyllabus,
  topic: SyllabusTopic,
): TopicSourceCoverage {
  const listedIn = syllabus.sources.filter((source) => topic.in.includes(source.id));
  return {
    listedIn,
    inPrimary: topic.in.includes(getPrimarySource(syllabus).id),
    singleSource: syllabus.sources.length < 2,
  };
}

// --- Planner view -----------------------------------------------------------
//
// The planner, quiz bank, mastery estimates and study timer know only the
// PRIMARY source's topics. Anything that feeds them must use these instead of
// SYLLABI / getSyllabus / getAllSyllabi, which also list topics that come only
// from another source (for example IPhO-only physics topics). Subtopics follow
// their parent topic.

export function isPlannerTopic(syllabus: SubjectSyllabus, topic: SyllabusTopic): boolean {
  return topic.in.includes(getPrimarySource(syllabus).id);
}

export function toPlannerSyllabus(syllabus: SubjectSyllabus): SubjectSyllabus {
  return {
    ...syllabus,
    sections: syllabus.sections
      .map((entry) => ({
        ...entry,
        topics: entry.topics.filter((topic) => isPlannerTopic(syllabus, topic)),
      }))
      // Keep practical sections (they have no topics); drop theory sections
      // that have nothing left.
      .filter((entry) => entry.part === "practical" || entry.topics.length > 0),
  };
}

export function getPlannerSyllabus(subject: string): SubjectSyllabus | undefined {
  const syllabus = getSyllabus(subject);
  return syllabus ? toPlannerSyllabus(syllabus) : undefined;
}

export function getPlannerSyllabi(): SubjectSyllabus[] {
  return getAllSyllabi().map(toPlannerSyllabus);
}

export function getPlannerTopicLocation(
  subject: string,
  topicId: string,
): LocatedTopic | undefined {
  const located = getTopicLocation(subject, topicId);
  const syllabus = getSyllabus(subject);
  if (!located || !syllabus) return undefined;
  return isPlannerTopic(syllabus, located.topic) ? located : undefined;
}

export function getPlannerTopicCount(subject: Subject): number {
  return getPlannerSyllabi()
    .find((entry) => entry.subject === subject)!
    .sections.reduce((total, entry) => total + entry.topics.length, 0);
}
