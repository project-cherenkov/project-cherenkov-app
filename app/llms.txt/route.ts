import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { getDocPages } from "@/lib/docs";
import { DEFAULT_LOCALE, isIndexingEnabled, isIndexableEditorial, localizedUrl } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

// /llms.txt — a plain-Markdown map of the site for LLM-based tools and answer
// engines (the emerging llmstxt.org convention). It costs nothing, is
// generated from the same content queries as the sitemap so it cannot drift,
// and gives an AI assistant a factual, link-rich summary to cite instead of
// guessing. It is a courtesy index, not an access-control mechanism: whether
// AI crawlers may *train* on the content is a separate policy decision made
// in robots.ts (see docs/seo-and-accessibility.md).
//
// While indexing is switched off (NEXT_PUBLIC_ALLOW_INDEXING unset) this
// returns a one-line notice rather than advertising a site that has asked not
// to be indexed.
export const dynamic = "force-static";

export function GET() {
  const headers = { "Content-Type": "text/plain; charset=utf-8" };

  if (!isIndexingEnabled()) {
    return new Response("# Project Cherenkov\n\nThis site is not open for indexing yet.\n", { headers });
  }

  const url = (path: string) => localizedUrl(DEFAULT_LOCALE, path);
  // Docs only exist in English for now; the /id/docs/* URLs are noindex
  // fallbacks, so point AI tools at the real pages.
  const docUrl = (slug: string) => localizedUrl("en", `/docs/${slug}`);
  const editorials = getAllEditorials().filter(isIndexableEditorial);
  const materials = getAllMaterials();
  const docs = getDocPages("en");

  const lines: string[] = [
    "# Project Cherenkov",
    "",
    "> Interactive olympiad editorials for informatics, physics and astronomy — every proof paired with a visualization you can manipulate. Built for Indonesian OSN (Olimpiade Sains Nasional) students. Open source (MIT).",
    "",
    "The site is available in Indonesian (/id) and English (/en). Editorials and materials are written in a single language and shown as written in both interfaces.",
    "",
    "## Sections",
    "",
    `- [Archive](${url("/archive")}): editorials indexed by principle and error type`,
    `- [Syllabus](${url("/syllabus")}): the OSN scope per subject, topic by topic`,
    `- [Materials](${url("/materials")}): short breakdowns of individual syllabus topics`,
    `- [Documentation](${url("/docs")}): how to use and contribute to the site`,
    `- [Sitemap](${siteUrl}/sitemap.xml)`,
    "",
    "## Documentation",
    "",
    ...docs.map(({ doc }) => `- [${doc.title}](${docUrl(doc.slug)}): ${doc.description}`),
    "",
    "## Editorials",
    "",
    ...editorials.map(
      (e) => `- [${e.title}](${url(`/archive/${e.subject}/${e.slug}`)}): ${e.hook}`,
    ),
    "",
    "## Materials",
    "",
    ...materials.map(
      (m) => `- [${m.title}](${url(`/materials/${m.subject}/${m.slug}`)}): ${m.summary}`,
    ),
    "",
  ];

  return new Response(lines.join("\n"), { headers });
}
