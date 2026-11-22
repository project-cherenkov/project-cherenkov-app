// Neutrino's system prompt. Pure and versioned so it can be tested and so a
// change to the wording is a visible, reviewable change. Nothing here reads the
// database or the browser: the route resolves page context on the server and
// passes it in.

export const COMPANION_PROMPT_VERSION = 1;

// Caps keep the per-request token cost of the content index predictable.
export const COMPANION_INDEX_MAX_ENTRIES = 120;
export const COMPANION_INDEX_TITLE_MAX = 80;
export const COMPANION_CONTEXT_FIELD_MAX = 400;

export type PageContextKind = "editorial" | "material";

/** What the browser may send about the page the student is reading. */
export type PageContextRef = { kind: PageContextKind; subject: string; slug: string };

/** What the server resolved from published content. Never from the browser. */
export type PageContext = {
  kind: PageContextKind;
  subject: string;
  title: string;
  principle?: string;
  errorType?: string;
  summary?: string;
};

export type ContentIndexEntry = { kind: PageContextKind; subject: string; slug: string; title: string };

const REF_PART = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Validates the untrusted `{ kind, subject, slug }` from the request body. */
export function parsePageContextRef(value: unknown): PageContextRef | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { kind, subject, slug } = value as Record<string, unknown>;
  if (kind !== "editorial" && kind !== "material") return null;
  if (typeof subject !== "string" || !REF_PART.test(subject)) return null;
  if (typeof slug !== "string" || !REF_PART.test(slug)) return null;
  return { kind, subject, slug };
}

/**
 * Which published page the student is on, from the locale-free pathname
 * (`/archive/<subject>/<slug>` or `/materials/<subject>/<slug>`). Only a hint:
 * the server validates it against published content.
 */
export function pageRefFromPath(pathname: string): PageContextRef | null {
  const [, root, subject, slug, extra] = pathname.split("/");
  if (extra !== undefined || !subject || !slug) return null;
  if (root !== "archive" && root !== "materials") return null;
  return parsePageContextRef({ kind: root === "archive" ? "editorial" : "material", subject, slug });
}

function oneLine(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}\u2026` : flat;
}

const BASE_PROMPT = [
  // Voice.
  "You are Neutrino, the study companion of Project Cherenkov, an Indonesian olympiad learning site for informatics, physics and astronomy.",
  "Voice: plain and precise, never hyped. State your assumptions and the scope of a claim. Keep established results apart from approximations, and say so when you are unsure. Do not claim to know Cherenkov content that was not given to you below.",
  // Pedagogy.
  "Teaching: give a hint before an answer. When it helps, ask the student to predict the outcome before you reveal it. Explain by principle, not by recipe. When the student shows their own work, check it step by step and name the first wrong step. Offer one idea at a time.",
  // Language.
  "Reply in the language the student writes in.",
  // Formatting.
  "Formatting: your reply is rendered as Markdown. You may use lists, bold, inline code and fenced code blocks, but do not use tables, images or HTML. Write maths with dollar delimiters only: $...$ inline and $$...$$ for display. Keep replies brief by default; a longer answer is for when the student asks for depth. Link only to pages listed in the index below, as /archive/<subject>/<slug> for editorials and /materials/<subject>/<slug> for materials.",
].join("\n\n");

/** Builds the full system instruction for one request. */
export function buildSystemPrompt(options: {
  page?: PageContext | null;
  index?: readonly ContentIndexEntry[];
} = {}): string {
  const parts = [BASE_PROMPT];

  const page = options.page;
  if (page) {
    const lines = [
      `The student is currently reading a ${page.kind}: "${oneLine(page.title, COMPANION_INDEX_TITLE_MAX)}" (${page.subject}).`,
      page.principle ? `Principle: ${oneLine(page.principle, COMPANION_CONTEXT_FIELD_MAX)}` : "",
      page.errorType ? `Common error it addresses: ${oneLine(page.errorType, COMPANION_CONTEXT_FIELD_MAX)}` : "",
      page.summary ? `Summary: ${oneLine(page.summary, COMPANION_CONTEXT_FIELD_MAX)}` : "",
      "You only know the details above, not the full text of the page.",
    ].filter(Boolean);
    parts.push(lines.join("\n"));
  }

  const index = (options.index ?? []).slice(0, COMPANION_INDEX_MAX_ENTRIES);
  if (index.length > 0) {
    const rows = index.map(
      (entry) => `- ${entry.kind} ${entry.subject}/${entry.slug}: ${oneLine(entry.title, COMPANION_INDEX_TITLE_MAX)}`,
    );
    parts.push(["Published pages you can point to (kind subject/slug: title):", ...rows].join("\n"));
  }

  return parts.join("\n\n");
}
