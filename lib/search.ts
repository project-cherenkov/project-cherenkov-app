// Site-wide search (R6). A small in-house index and scorer: no hosted search
// service and no search library, so core navigation has no runtime dependency
// and no learner's query ever leaves the browser.
//
// Pure, so it is testable and usable from both the build-time route handler
// (app/api/search-index/[locale]/route.ts, which builds the JSON) and the
// browser (components/site/search-palette.tsx, which loads it lazily and
// scores locally).
//
// Scoring is deliberately simple and explainable: every word the student
// typed must match the START of some word in the entry (so "binar" finds
// "binary"), title words count most, then tags/principle/topic words, then
// the summary. Accents and case are ignored.
import { localize, type SubjectSyllabus } from "./syllabus";

export type SearchKind = "topic" | "material" | "editorial" | "doc";

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  // Short context line: a summary, hook, or the syllabus section.
  summary: string;
  // Locale-less path; the UI's Link adds the locale prefix.
  href: string;
  subject?: string;
  // Extra words that should find this entry (tags, principle, topic, ...).
  keywords: string[];
}

export interface SearchSources {
  editorials: {
    subject: string;
    slug: string;
    title: string;
    hook: string;
    tags: string[];
    principle: string;
    errorType?: string;
    syllabusTopic?: string;
  }[];
  materials: { subject: string; slug: string; title: string; summary: string; topic: string }[];
  docs: { slug: string; title: string; description: string }[];
  syllabi: SubjectSyllabus[];
}

export function buildSearchIndex(sources: SearchSources, locale: string): SearchEntry[] {
  const entries: SearchEntry[] = [];

  // topic id -> localized names, per subject
  const topicNames = new Map<string, string>();
  const sectionNames = new Map<string, string>();
  const topicHasMaterial = new Set(
    sources.materials.map((m) => `${m.subject}/${m.topic}`),
  );
  for (const syllabus of sources.syllabi) {
    for (const section of syllabus.sections) {
      for (const topic of section.topics) {
        const key = `${syllabus.subject}/${topic.id}`;
        topicNames.set(key, localize(topic.name, locale));
        sectionNames.set(key, localize(section.name, locale));
        // A topic that has a material is found through the material; listing
        // both would show the same name twice.
        if (topicHasMaterial.has(key)) continue;
        entries.push({
          id: `topic:${key}`,
          kind: "topic",
          title: localize(topic.name, locale),
          summary: localize(section.name, locale),
          href: `/syllabus/${syllabus.subject}#topic-${topic.id}`,
          subject: syllabus.subject,
          keywords: topic.detail ? [topic.detail] : [],
        });
      }
    }
  }

  for (const m of sources.materials) {
    const key = `${m.subject}/${m.topic}`;
    entries.push({
      id: `material:${m.subject}/${m.slug}`,
      kind: "material",
      title: m.title,
      summary: m.summary,
      href: `/materials/${m.subject}/${m.slug}`,
      subject: m.subject,
      keywords: [topicNames.get(key), sectionNames.get(key)].filter((v): v is string => Boolean(v)),
    });
  }

  for (const e of sources.editorials) {
    const key = e.syllabusTopic ? `${e.subject}/${e.syllabusTopic}` : null;
    entries.push({
      id: `editorial:${e.subject}/${e.slug}`,
      kind: "editorial",
      title: e.title,
      summary: e.hook,
      href: `/archive/${e.subject}/${e.slug}`,
      subject: e.subject,
      keywords: [
        ...e.tags,
        e.principle,
        ...(e.errorType ? [e.errorType] : []),
        ...(key && topicNames.get(key) ? [topicNames.get(key)!] : []),
      ],
    });
  }

  for (const d of sources.docs) {
    entries.push({
      id: `doc:${d.slug}`,
      kind: "doc",
      title: d.title,
      summary: d.description,
      href: `/docs/${d.slug}`,
      keywords: [],
    });
  }
  return entries;
}

// --- Matching ---------------------------------------------------------------

// Lowercase, strip accents, split on anything that is not a letter or digit.
// Hyphens and underscores split words, so the tag "binary-search" is two
// words.
export function tokenize(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const WEIGHTS = {
  titleExact: 10,
  titlePrefix: 6,
  keywordExact: 5,
  keywordPrefix: 3,
  summaryExact: 2,
  summaryPrefix: 1,
  phraseInTitle: 8,
} as const;

// Higher = shown earlier when scores tie: syllabus topics are the most
// "navigational" results, docs the least.
const KIND_ORDER: Record<SearchKind, number> = { topic: 0, material: 1, editorial: 2, doc: 3 };

function bestWordScore(
  queryToken: string,
  words: string[],
  exact: number,
  prefix: number,
): number {
  let best = 0;
  for (const word of words) {
    if (word === queryToken) return exact;
    if (word.startsWith(queryToken)) best = Math.max(best, prefix);
  }
  return best;
}

export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

export function searchEntries(
  entries: SearchEntry[],
  query: string,
  limit = 8,
): SearchHit[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const phrase = queryTokens.join(" ");

  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const titleWords = tokenize(entry.title);
    const keywordWords = entry.keywords.flatMap(tokenize);
    const summaryWords = tokenize(entry.summary);

    let score = 0;
    let matchedAll = true;
    for (const token of queryTokens) {
      const s = Math.max(
        bestWordScore(token, titleWords, WEIGHTS.titleExact, WEIGHTS.titlePrefix),
        bestWordScore(token, keywordWords, WEIGHTS.keywordExact, WEIGHTS.keywordPrefix),
        bestWordScore(token, summaryWords, WEIGHTS.summaryExact, WEIGHTS.summaryPrefix),
      );
      if (s === 0) {
        matchedAll = false;
        break;
      }
      score += s;
    }
    if (!matchedAll) continue;
    if (titleWords.join(" ").includes(phrase)) score += WEIGHTS.phraseInTitle;
    hits.push({ entry, score });
  }

  return hits
    .sort(
      (a, b) =>
        b.score - a.score ||
        KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] ||
        a.entry.title.localeCompare(b.entry.title),
    )
    .slice(0, limit);
}
