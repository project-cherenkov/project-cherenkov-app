// Neutrino's built-in FAQ: which questions exist, how they are grouped, which
// pages each answer points to, and how a student searches them.
//
// The words themselves live in messages/en.json and messages/id.json under
// `companion.faq.items.<id>.q` and `.a`, so the FAQ is bilingual like the rest
// of the interface. Adding a question is three steps: add an entry to FAQ_ITEMS
// below, add its `q` and `a` to both message files, and run the tests. The
// tests fail if a question has no text in one language, if a `related` id does
// not exist, or if a link label is missing.
//
// Numbers that the server enforces (the daily chat limit and so on) are not
// typed into the answers. They are passed in as values from
// lib/companion-settings.ts, so an answer cannot disagree with the real limit.

import { COMPANION_DAILY_LIMIT, COMPANION_MAX_HISTORY, COMPANION_MAX_MESSAGE_CHARS } from "@/lib/companion-settings";

export const FAQ_GROUPS = ["start", "reading", "planner", "timer", "neutrino", "account", "help"] as const;
export type FaqGroup = (typeof FAQ_GROUPS)[number];

// Each key is a label under `companion.faq.links.<key>` in the messages. Every
// href is a locale-less page address; the locale-aware <Link> adds the locale.
export const FAQ_LINKS = {
  about: "/about",
  account: "/account",
  archive: "/archive",
  contributing: "/docs/contributing",
  docsNeutrino: "/docs/neutrino",
  docsPlanner: "/docs/study-planner",
  docsReading: "/docs/reading-an-editorial",
  docsStart: "/docs/getting-started",
  docsViz: "/docs/using-visualizations",
  docsWriting: "/docs/writing-editorials",
  forgotPassword: "/forgot-password",
  login: "/login",
  materials: "/materials",
  planner: "/planner",
  privacy: "/privacy",
  progress: "/planner/progress",
  review: "/planner/review",
  signup: "/signup",
  syllabus: "/syllabus",
  timer: "/timer",
} as const;
export type FaqLinkKey = keyof typeof FAQ_LINKS;

export interface FaqItem {
  id: string;
  group: FaqGroup;
  /** Up to three question ids offered as follow-ups after this answer. */
  related: readonly string[];
  links?: readonly FaqLinkKey[];
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  // Getting started
  { id: "what-is", group: "start", related: ["three-sections", "account-needed", "where-begin"], links: ["docsStart", "about"] },
  { id: "account-needed", group: "start", related: ["planner-what", "faq-vs-ai", "data-stored"], links: ["signup"] },
  { id: "three-sections", group: "start", related: ["where-begin", "syllabus-link", "subjects-coverage"], links: ["syllabus", "materials", "archive"] },
  { id: "where-begin", group: "start", related: ["three-sections", "anatomy", "search"], links: ["syllabus", "archive"] },
  { id: "subjects-coverage", group: "start", related: ["three-sections", "planner-quiz", "contribute"], links: ["syllabus"] },
  { id: "language", group: "start", related: ["search", "phone", "contribute"] },
  { id: "search", group: "start", related: ["where-begin", "language", "data-stored"] },
  { id: "phone", group: "start", related: ["viz-controls", "neutrino-resize", "neutrino-move"] },

  // Reading and visualizations
  { id: "anatomy", group: "reading", related: ["principle-error", "try-first", "viz-controls"], links: ["docsReading"] },
  { id: "principle-error", group: "reading", related: ["anatomy", "where-begin", "report"], links: ["archive"] },
  { id: "try-first", group: "reading", related: ["anatomy", "viz-controls", "data-stored"] },
  { id: "viz-controls", group: "reading", related: ["viz-broken", "phone", "accessibility"], links: ["docsViz"] },
  { id: "viz-broken", group: "reading", related: ["viz-controls", "report", "accessibility"], links: ["contributing"] },
  { id: "syllabus-link", group: "reading", related: ["three-sections", "planner-what", "where-begin"], links: ["syllabus"] },

  // Study planner and quizzes
  { id: "planner-what", group: "planner", related: ["planner-setup", "planner-confirm", "account-needed"], links: ["planner", "docsPlanner"] },
  { id: "planner-setup", group: "planner", related: ["planner-confirm", "planner-contents", "planner-short"], links: ["planner"] },
  { id: "planner-confirm", group: "planner", related: ["planner-quiz", "planner-contents", "planner-trust"] },
  { id: "planner-contents", group: "planner", related: ["planner-short", "planner-regen", "timer-how"], links: ["planner"] },
  { id: "planner-short", group: "planner", related: ["planner-setup", "planner-regen", "planner-contents"], links: ["planner"] },
  { id: "planner-regen", group: "planner", related: ["planner-contents", "planner-quiz", "planner-trust"] },
  { id: "planner-quiz", group: "planner", related: ["missed-questions", "planner-confirm", "subjects-coverage"], links: ["planner"] },
  { id: "planner-trust", group: "planner", related: ["planner-confirm", "planner-quiz", "report"], links: ["docsPlanner"] },

  // Timer and progress
  { id: "timer-how", group: "timer", related: ["timer-count", "timer-save", "neutrino-what"], links: ["timer"] },
  { id: "timer-count", group: "timer", related: ["timer-save", "progress-page", "timer-how"] },
  { id: "timer-save", group: "timer", related: ["timer-count", "progress-page", "account-needed"], links: ["timer", "login"] },
  { id: "progress-page", group: "timer", related: ["missed-questions", "timer-count", "data-stored"], links: ["progress"] },
  { id: "missed-questions", group: "timer", related: ["planner-quiz", "progress-page", "planner-regen"], links: ["review"] },

  // Neutrino, the FAQ and the AI
  { id: "neutrino-what", group: "neutrino", related: ["faq-vs-ai", "neutrino-settings", "neutrino-move"], links: ["docsNeutrino"] },
  { id: "faq-vs-ai", group: "neutrino", related: ["ai-trust", "ai-limits", "ai-off"], links: ["docsNeutrino"] },
  { id: "ai-trust", group: "neutrino", related: ["ai-privacy", "ai-limits", "faq-miss"] },
  { id: "ai-limits", group: "neutrino", related: ["ai-key", "ai-trust", "ai-privacy"], links: ["docsNeutrino"] },
  { id: "ai-privacy", group: "neutrino", related: ["ai-off", "ai-key", "data-stored"], links: ["privacy"] },
  { id: "ai-key", group: "neutrino", related: ["ai-limits", "ai-privacy", "ai-off"], links: ["docsNeutrino"] },
  { id: "ai-off", group: "neutrino", related: ["neutrino-settings", "ai-privacy", "faq-vs-ai"], links: ["account"] },
  { id: "neutrino-settings", group: "neutrino", related: ["ai-off", "neutrino-move", "neutrino-resize"], links: ["account"] },
  { id: "neutrino-move", group: "neutrino", related: ["neutrino-resize", "neutrino-float", "neutrino-settings"] },
  { id: "neutrino-resize", group: "neutrino", related: ["neutrino-move", "neutrino-float", "phone"] },
  { id: "neutrino-float", group: "neutrino", related: ["neutrino-move", "neutrino-resize", "timer-how"], links: ["docsNeutrino"] },
  { id: "faq-miss", group: "neutrino", related: ["faq-vs-ai", "search", "report"], links: ["docsStart"] },

  // Account and privacy
  { id: "data-stored", group: "account", related: ["data-delete", "ai-privacy", "account-needed"], links: ["privacy"] },
  { id: "data-delete", group: "account", related: ["data-stored", "progress-page", "report"], links: ["privacy", "progress"] },
  { id: "roles", group: "account", related: ["account-needed", "contribute", "data-stored"], links: ["account"] },
  { id: "password", group: "account", related: ["account-needed", "data-stored", "report"], links: ["forgotPassword", "account"] },

  // Reporting and contributing
  { id: "report", group: "help", related: ["accessibility", "viz-broken", "contribute"], links: ["contributing"] },
  { id: "accessibility", group: "help", related: ["report", "viz-controls", "neutrino-move"], links: ["contributing"] },
  { id: "contribute", group: "help", related: ["report", "language", "roles"], links: ["contributing", "docsWriting"] },
];

export const FAQ_BY_ID: ReadonlyMap<string, FaqItem> = new Map(FAQ_ITEMS.map((item) => [item.id, item]));

/** Values every answer may use, e.g. `{limit}` in "Up to {limit} chat requests". */
export const FAQ_VALUES = {
  limit: COMPANION_DAILY_LIMIT,
  chars: COMPANION_MAX_MESSAGE_CHARS,
  history: COMPANION_MAX_HISTORY,
} as const;

export interface FaqText {
  id: string;
  question: string;
  answer: string;
}

// Lower-case and drop accents, so "visualisasi", "Visualisasi" and a query typed
// without diacritics all compare equal.
function normalise(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Filters and ranks the FAQ for a search box. Every word the student typed must
 * appear in the question or the answer. Matches in the question rank above
 * matches only in the answer; ties keep the FAQ's own order. An empty query
 * returns everything unchanged.
 */
export function searchFaq<T extends FaqText>(entries: readonly T[], query: string): T[] {
  const words = normalise(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return [...entries];
  const ranked: Array<{ entry: T; score: number; order: number }> = [];
  entries.forEach((entry, order) => {
    const question = normalise(entry.question);
    const answer = normalise(entry.answer);
    let score = 0;
    for (const word of words) {
      const inQuestion = question.includes(word);
      if (!inQuestion && !answer.includes(word)) return;
      score += inQuestion ? 2 : 1;
    }
    ranked.push({ entry, score, order });
  });
  return ranked.sort((a, b) => b.score - a.score || a.order - b.order).map((item) => item.entry);
}
