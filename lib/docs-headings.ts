// Heading ids + table of contents for the docs, kept in one dependency-free
// module so the two halves can never disagree:
//
//   • rehypeHeadingIds()  — a rehype plugin Velite runs while compiling a doc's
//     MDX; it stamps an `id` on every h2–h6 so headings are deep-linkable.
//   • extractToc()        — reads the same document's raw Markdown and returns
//     the "On this page" entries, using the SAME slug function and the SAME
//     duplicate-handling.
//
// Both run in document order and both skip fenced code, so the n-th heading
// gets the same id in each. Authors should keep headings plain text; inline
// code, bold and links are stripped for the id but are fine to use.

export interface TocEntry {
  depth: 2 | 3;
  title: string;
  id: string;
}

/** Close to github-slugger: lowercase, drop punctuation, spaces → hyphens. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Creates a slugger that suffixes repeats (-1, -2, …) like GitHub does. */
export function createSlugger() {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = slugify(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

/** Plain text of a Markdown heading line's content. */
function stripInlineMarkdown(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → label
    .replace(/[`*~]/g, "") // code ticks, bold/italic stars, strikethrough
    .replace(/\s+#+\s*$/, "") // optional closing #s
    .trim();
}

export function extractToc(markdown: string): TocEntry[] {
  const slug = createSlugger();
  const entries: TocEntry[] = [];
  let fence: string | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]!.charAt(0);
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;

    const heading = /^(#{2,6})\s+(.+?)\s*$/.exec(line);
    if (!heading) continue;
    const depth = heading[1]!.length;
    const title = stripInlineMarkdown(heading[2]!);
    const id = slug(title);
    if (depth === 2 || depth === 3) {
      entries.push({ depth: depth as 2 | 3, title, id });
    }
  }
  return entries;
}

// --- rehype plugin (minimal hast shapes; no @types/hast dependency) ---------

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

const HEADING = /^h([2-6])$/;

export function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const slug = createSlugger();
    const walk = (node: HastNode) => {
      if (node.type === "element" && node.tagName && HEADING.test(node.tagName)) {
        node.properties = node.properties ?? {};
        // Respect an id an author set explicitly (and still count it, so a
        // later duplicate heading doesn't collide with it).
        const text = textOf(node).trim();
        const generated = slug(text);
        if (node.properties.id === undefined) node.properties.id = generated;
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}
