
import { localizedUrl } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { getUpdates } from "@/lib/updates";

// An RSS 2.0 feed of /updates. One feed, not one per language: each item is the
// original text (its summary only; the entry itself is on the page), and links
// to the page anchor. Static, generated from the same content as the page.
export const dynamic = "force-static";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const entries = getUpdates("en");
  // Titles and summaries are the English originals, so the items link to the
  // English page rather than the default-locale (Indonesian) one.
  const page = localizedUrl("en", "/updates");
  const newest = entries
    .map(({ date }) => new Date(date.includes("T") ? date : `${date}T00:00:00Z`).getTime())
    .sort((a, b) => b - a)[0];
  const lastBuildDate = newest ? new Date(newest).toUTCString() : "";
  const items = entries
    .map(({ update, date }) => {
      const link = `${page}#${update.slug}`;
      return [
        "    <item>",
        `      <title>${escapeXml(update.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${new Date(date.includes("T") ? date : `${date}T00:00:00Z`).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(update.summary)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Project Cherenkov: updates</title>
    <link>${escapeXml(page)}</link>
    <atom:link href="${escapeXml(`${siteUrl}/updates/feed.xml`)}" rel="self" type="application/rss+xml" />
    <description>Changes to the syllabus, content and features of Project Cherenkov.</description>
    <language>en</language>
${lastBuildDate ? `    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` : ""}
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
