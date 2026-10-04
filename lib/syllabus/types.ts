import type { Subject } from "../subjects";

export type SyllabusLocale = "id" | "en";

// Every name is stored in both site locales so the EN/ID toggle never has to
// fall back mid-page. Only ONE of the two is the official wording — which one
// is recorded per subject in `SubjectSyllabus.sourceLang`. The other is an
// unofficial translation and the UI says so (see syllabus.translationNote).
export type LocalizedText = Record<SyllabusLocale, string>;

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
}

export interface SubjectSyllabus {
  subject: Subject;
  sourceLang: SyllabusLocale;
  source: SyllabusSource;
  sections: SyllabusSection[];
}
