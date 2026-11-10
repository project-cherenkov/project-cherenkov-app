import type { Subject } from "../subjects";

export type SyllabusLocale = "id" | "en";

// Every name is stored in both site locales so the EN/ID toggle never has to
// fall back mid-page. Only ONE of the two is the official wording — which one
// is the language of the topic's first source (`SyllabusSource.language`, via
// `SyllabusTopic.in`). The other is an unofficial translation and the UI says
// so (see syllabus.translationNote).
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
  // Extra scope text copied from the source, in the language of the topic's
  // FIRST source (see `in`). Written only for topics that have such text.
  detail?: string;
  // Which registered sources (SubjectSyllabus.sources) list this topic, by id.
  // The first id is the source whose wording the topic's name follows. This is
  // membership, not a category: the labels the site shows ("OSN and IPhO",
  // "OSN only", …) are generated from it, so a third source can be added
  // without touching any existing topic. Every topic needs at least one id,
  // and an id may only be listed if the topic really appears in that source.
  in: string[];
  // Optional pointer to the exact place in a source, keyed by source id
  // (for example { ipho: "§2.4.3" } or { ioi: "AL3a" }). Only for ids in `in`.
  refs?: Record<string, string>;
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
  // Practical sections have no topics to carry membership, so a practical
  // section may name the sources it comes from directly. Unused for theory
  // sections: theirs is computed from their topics.
  in?: string[];
}

// How far a source's entry in this repo has been checked against the source
// itself. Shown to readers in plain language (see syllabus.verification.*).
//   "compared"     — the topic list was compared with the primary document.
//   "secondary"    — known only from summaries or copies, not the primary
//                    document.
//   "not-compared" — not yet compared at all.
export type SourceVerification = "compared" | "secondary" | "not-compared";

export interface SyllabusSource {
  // Stable id, unique within a subject ("osn", "ipho", "ioi", "ioaa", …).
  // Topics point at it through `SyllabusTopic.in`.
  id: string;
  // "national" sources are Indonesian (OSN); "international" are not.
  kind: "national" | "international";
  // Short name used in badges ("OSN", "IPhO", "IOI", "IOAA").
  short: string;
  // Name of the document.
  label: string;
  // The body that issues it.
  issuer: string;
  edition?: string;
  url?: string;
  // The language of the OFFICIAL text. Any other language in the topic names
  // is an unofficial gloss written here.
  language: SyllabusLocale;
  // ISO date (YYYY-MM-DD) on which the topic list in this file was last
  // compared against `url`. Leave it unset until that comparison has actually
  // been made — a date here is a claim that the data was checked.
  accessed?: string;
  verification: SourceVerification;
  // Optional caveat shown with the source, in both locales.
  note?: LocalizedText;
}

export interface SubjectSyllabus {
  subject: Subject;
  // The registry of syllabuses this subject's topics come from. The FIRST
  // entry is the primary source: the one the planner, quiz bank and mastery
  // estimates are built on (for all three subjects today, the OSN guide or
  // the OSN list's own basis). Topics that are not in it never reach those.
  sources: SyllabusSource[];
  sections: SyllabusSection[];
}
