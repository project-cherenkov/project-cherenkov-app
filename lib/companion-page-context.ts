// Resolves the page a student is reading into text the system prompt can use.
// The browser only names the page ({ kind, subject, slug }); the text always
// comes from published content on the server, so a hand-made request cannot
// put its own words into the system prompt, and drafts are never used.
import { getAllEditorials, getAllMaterials, getEditorial, getMaterial } from "@/lib/content";
import type { ContentIndexEntry, PageContext, PageContextRef } from "@/lib/companion-prompt";

export function resolvePageContext(ref: PageContextRef | null): PageContext | null {
  if (!ref) return null;
  // No `includeDrafts`: the helpers return published content only.
  if (ref.kind === "editorial") {
    const item = getEditorial(ref.subject, ref.slug);
    if (!item) return null;
    return {
      kind: "editorial",
      subject: item.subject,
      title: item.title,
      principle: item.principle,
      errorType: item.errorType,
      // Editorials have a `hook`, not a `summary`.
      summary: item.hook,
    };
  }
  const item = getMaterial(ref.subject, ref.slug);
  if (!item) return null;
  return { kind: "material", subject: item.subject, title: item.title, summary: item.summary };
}

export function listContentIndex(): ContentIndexEntry[] {
  return [
    ...getAllEditorials().map((e) => ({ kind: "editorial" as const, subject: e.subject, slug: e.slug, title: e.title })),
    ...getAllMaterials().map((m) => ({ kind: "material" as const, subject: m.subject, slug: m.slug, title: m.title })),
  ];
}
