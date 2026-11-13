import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { getDocPages } from "@/lib/docs";
import { isIndexingEnabled, isIndexableEditorial, localizedUrl } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

// /llms.txt — a plain-Markdown map of the site for LLM-based tools and answer
// engines (the emerging llmstxt.org convention). It costs nothing, is
// generated from the same content queries as the sitemap so it cannot drift,
// and gives an AI assistant a factual, link-rich summary to cite instead of
// guessing. It is a courtesy index, not an access-control mechanism: whether
// AI crawlers may *train* on the content is a separate policy decision made
// in robots.ts (see docs/engineering/seo-and-accessibility.md).
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

  // The editorial and material text is English, so point English-reading AI
  // tools at the /en/ pages rather than the Indonesian interface.
  const url = (path: string) => localizedUrl("en", path);
  // Docs only exist in English for now; the /id/docs/* URLs are noindex
  // fallbacks, so point AI tools at the real pages.
  const docUrl = (slug: string) => localizedUrl("en", `/docs/${slug}`);
  const editorials = getAllEditorials().filter(isIndexableEditorial);
  const materials = getAllMaterials();
  const docs = getDocPages("en");

  const lines: string[] = [
    "# Project Cherenkov",
    "",
    "> Interactive olympiad editorials for physics, astronomy and informatics, written in English with an Indonesian interface and an OSN-first syllabus and study planner. Every proof comes with a visualization you can manipulate. Open source (MIT).",
    "",
    "The site is available in English (/en) and Indonesian (/id); the Indonesian interface is the default for visitors from Indonesia. Each editorial and material is written in one language and shown as written until a translation exists; a page says so when it is not in your language.",
    "",
    "## Sections",
    "",
    `- [Archive](${url("/archive")}): editorials indexed by principle and error type`,
    `- [Syllabus](${url("/syllabus")}): the scope per subject, topic by topic, each topic labelled with the syllabuses that list it (OSN, and IPhO, IOI or IOAA)`,
    `- [Materials](${url("/materials")}): short breakdowns of individual syllabus topics`,
    `- [Documentation](${url("/docs")}): how to use and contribute to the site`,
    `- [Updates](${url("/updates")}): changes to the syllabus, content and features (RSS: ${siteUrl}/updates/feed.xml)`,
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
