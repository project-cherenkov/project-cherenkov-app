// Pure helpers for rendering chat text (the student's messages and Neutrino's
// replies). Model output is untrusted, so what may become a link, and which
// dollar signs are maths, is decided here and unit-tested.

// Routes under app/[locale]/ a reply may link to as a clickable internal path.
// A path is clickable only when its first segment is listed here.
const INTERNAL_ROOTS = new Set([
  "archive",
  "materials",
  "syllabus",
  "docs",
  "updates",
  "planner",
  "progress",
  "review",
  "timer",
  "about",
]);

export type LinkTarget =
  | { kind: "internal"; href: string }
  | { kind: "external"; href: string }
  | { kind: "text" };

/**
 * Internal paths must match a known route. External links must be https.
 * Everything else (javascript:, data:, http:, mailto:, protocol-relative URLs,
 * unknown paths) is shown as plain text.
 */
export function classifyHref(href: string | undefined): LinkTarget {
  if (!href) return { kind: "text" };
  const value = href.trim();
  if (value.startsWith("/") && !value.startsWith("//")) {
    const path = value.split(/[?#]/)[0] ?? "";
    const root = path.split("/")[1] ?? "";
    // No backslashes or control characters: some browsers treat "/\\" as "//".
    // eslint-disable-next-line no-control-regex
    if (/[\\\u0000-\u001f]/.test(value)) return { kind: "text" };
    return INTERNAL_ROOTS.has(root) ? { kind: "internal", href: value } : { kind: "text" };
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname) return { kind: "external", href: url.toString() };
  } catch {
    // Not a URL.
  }
  return { kind: "text" };
}

/**
 * remark-math treats any `$...$` as maths, so "it costs $5 and $6" would turn
 * "5 and " into a formula. This applies the usual pandoc rule: an opening `$`
 * must be followed by a non-space, and a closing `$` must follow a non-space
 * and must not be followed by a digit. A `$` that cannot be part of a pair is
 * escaped. Code (fenced or inline) and `$$` display maths are left alone.
 * `\(...\)` and `\[...\]` are converted to dollar delimiters.
 */
export function prepareChatMarkdown(input: string): string {
  const converted = input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body: string) => `\n$$${body}$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body: string) => `$${body.trim()}$`);

  // Split into code and non-code parts. An unclosed fence runs to the end.
  const parts = converted.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g);
  return parts.map((part, index) => (index % 2 === 1 ? part : protectCurrency(part))).join("");
}

function protectCurrency(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === "\\" && i + 1 < text.length) {
      out += ch + text[i + 1];
      i += 2;
      continue;
    }
    if (ch !== "$") {
      out += ch;
      i += 1;
      continue;
    }
    if (text[i + 1] === "$") {
      // Display maths: keep it, with its closing `$$` if there is one.
      const close = text.indexOf("$$", i + 2);
      if (close === -1) {
        out += text.slice(i);
        break;
      }
      out += text.slice(i, close + 2);
      i = close + 2;
      continue;
    }
    const next = text[i + 1];
    let closeAt = -1;
    if (next !== undefined && !/\s/.test(next)) {
      for (let j = i + 1; j < text.length; j += 1) {
        const c = text[j]!;
        if (c === "\n" && text[j + 1] === "\n") break; // not across paragraphs
        if (c === "\\") {
          j += 1;
          continue;
        }
        if (c !== "$") continue;
        if (text[j + 1] === "$") break;
        const prev = text[j - 1]!;
        const after = text[j + 1];
        if (!/\s/.test(prev) && !(after !== undefined && /\d/.test(after))) {
          closeAt = j;
          break;
        }
      }
    }
    if (closeAt === -1) {
      out += "\\$";
      i += 1;
    } else {
      out += text.slice(i, closeAt + 1);
      i = closeAt + 1;
    }
  }
  return out;
}
