import type { Subject } from "../subjects";
import type {
  LocalizedText,
  SubjectSyllabus,
  SyllabusSection,
  SyllabusSource,
  SyllabusSubtopic,
  SyllabusTopic,
} from "./types";

// Tiny authoring helpers so the data files read as tables, not as walls of
// nested braces. Argument order is always: id, Indonesian, English.
const text = (id: string, en: string): LocalizedText => ({ id, en });

export function topic(
  id: string,
  nameId: string,
  nameEn: string,
  detail?: string,
  subtopics?: SyllabusSubtopic[],
): SyllabusTopic {
  // `in` starts empty on purpose: defineSyllabus() fills it with the primary
  // source, and inSources() names any other. A topic that reaches the exported
  // syllabus with an empty `in` is a bug the tests catch.
  return {
    id,
    name: text(nameId, nameEn),
    in: [],
    ...(detail ? { detail } : {}),
    ...(subtopics && subtopics.length > 0 ? { subtopics } : {}),
  };
}

// Names the sources that list a topic, first the one whose wording the topic's
// name follows, plus optional pointers into them (see SyllabusTopic.refs).
export function inSources(
  entry: SyllabusTopic,
  ids: string[],
  refs?: Record<string, string>,
): SyllabusTopic {
  return { ...entry, in: ids, ...(refs ? { refs } : {}) };
}

// A Cherenkov-authored slice of a topic (see SyllabusSubtopic). Same argument
// order as `topic`: id, Indonesian, English, then the optional scope note.
export function subtopic(
  id: string,
  nameId: string,
  nameEn: string,
  detail?: string,
): SyllabusSubtopic {
  return { id, name: text(nameId, nameEn), ...(detail ? { detail } : {}) };
}

export function section(
  id: string,
  nameId: string,
  nameEn: string,
  topics: SyllabusTopic[],
): SyllabusSection {
  return { id, name: text(nameId, nameEn), part: "theory", topics };
}

export function practical(
  id: string,
  nameId: string,
  nameEn: string,
  note?: string,
): SyllabusSection {
  return {
    id,
    name: text(nameId, nameEn),
    part: "practical",
    topics: [],
    ...(note ? { note } : {}),
  };
}

// Assembles a subject's syllabus. Topics (and practical sections) that name no
// source default to the FIRST registered one, which keeps the data files for
// the primary source free of repetition: only the topics that differ say so.
export function defineSyllabus(input: {
  subject: Subject;
  sources: SyllabusSource[];
  // What a topic with no explicit membership defaults to. Omit for the
  // primary source alone; astronomy lists both of its sources for every topic.
  defaultIn?: string[];
  sections: SyllabusSection[];
}): SubjectSyllabus {
  const primary = input.sources[0]?.id;
  if (!primary) throw new Error(`${input.subject}: a syllabus needs at least one source`);
  const fallback = input.defaultIn ?? [primary];
  const { defaultIn: _defaultIn, ...rest } = input;
  void _defaultIn;
  return {
    ...rest,
    sections: input.sections.map((entry) => ({
      ...entry,
      topics: entry.topics.map((t) => (t.in.length > 0 ? t : { ...t, in: fallback })),
      ...(entry.part === "practical" && !entry.in ? { in: fallback } : {}),
    })),
  };
}
