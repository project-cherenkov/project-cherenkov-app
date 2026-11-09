import type {
  LocalizedText,
  SyllabusSection,
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
  return {
    id,
    name: text(nameId, nameEn),
    ...(detail ? { detail } : {}),
    ...(subtopics && subtopics.length > 0 ? { subtopics } : {}),
  };
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
