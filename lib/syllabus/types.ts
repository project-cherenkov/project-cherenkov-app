import type { Subject } from "../subjects";

export type SyllabusLocale = "id" | "en";

// Every name is stored in both site locales so the EN/ID toggle never has to
// fall back mid-page. Only ONE of the two is the official wording — which one
// is recorded per subject in `SubjectSyllabus.sourceLang`. The other is an
// unofficial translation and the UI says so (see syllabus.translationNote).
export type LocalizedText = Record<SyllabusLocale, string>;

// A finer-grained slice of one topic. Subtopics are Project Cherenkov's OWN
// subdivision: the source syllabus does not list them, so a subtopic's `detail`
// is written here and is never a quotation of the source. They exist because a
// material or editorial is often about one idea inside a broad topic (for
// example "Sidereal and synodic periods" inside "The Solar System") and
// should be findable by that name.
//
// Subtopics are a presentation and content-linking layer ONLY. The planner,
// quiz bank, mastery estimates and study timer all stay at topic level: they
// know nothing about subtopics and never will unless that is built on purpose.
export interface SyllabusSubtopic {
  // Stable slug. Shares ONE namespace with topic ids inside a subject (a
  // subtopic id may not equal any topic id or any other subtopic id), so a
  // single `topic` / `syllabusTopic` frontmatter value can name either.
  id: string;
  name: LocalizedText;
  // Scope note written by Cherenkov, in the subject's source language.
  detail?: string;
}

export interface SyllabusTopic {
  // Stable slug, unique within its subject. Materials and editorials point at
  // this (`topic` / `syllabusTopic` frontmatter), so renaming one is a
  // breaking change — retitle via `name` instead.
  id: string;
  name: LocalizedText;
  // Extra scope text copied from the source, in the subject's source language.
  detail?: string;
  // Rough study effort for the planner: 1 = light, 2 = medium, 3 = heavy.
  // NOT YET AUTHORED for any topic — the planner must treat a missing value
  // as medium (2). Set it per topic when someone who knows the material has
  // an opinion; never fill it in from a guess.
  effort?: 1 | 2 | 3;
  // Optional Cherenkov-authored subdivisions of this topic (see
  // SyllabusSubtopic). Leave unset for a topic that needs none.
  subtopics?: SyllabusSubtopic[];
}

export interface SyllabusSection {
  // Unique across the whole subject (theory + practical).
  id: string;
  name: LocalizedText;
  // "theory" sections hold linkable topics. "practical" sections only carry a
  // free-text `note` — nothing links to them.
  part: "theory" | "practical";
  topics: SyllabusTopic[];
  note?: string;
}

export interface SyllabusSource {
  label: string;
  edition?: string;
  url?: string;
  // ISO date (YYYY-MM-DD) on which the topic list in this file was last
  // compared against `url`. Leave it unset until that comparison has actually
  // been made — a date here is a claim that the data was checked.
  accessed?: string;
}

export interface SubjectSyllabus {
  subject: Subject;
  sourceLang: SyllabusLocale;
  source: SyllabusSource;
  sections: SyllabusSection[];
}
