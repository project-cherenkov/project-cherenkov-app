import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// DEPLOYMENT-READINESS ADDITION, not part of the original spec — no
// robots.txt existed at all. /keystatic and /api are disallowed here as a
// second, independent layer on top of lib/admin-guard.ts's actual access
// control (a 404 doesn't need a disallow rule to be safe, but keeping
// well-behaved crawlers from even requesting it is good practice and
// costs nothing).
//
// SEO pass: the account-only pages (login, signup, planner, account) are now
// disallowed too. They carry no search value, they redirect or show a form,
// and crawling them just spends crawl budget. They are ALSO marked noindex in
// their own metadata, which is the part that actually keeps them out of the
// index if something links to them.
//
// IMPORTANT interaction: a page blocked here can never have its noindex read.
// That is fine for the pages above (they are not meant to be indexed either
// way), but do NOT add pages you want to *remove* from search results to this
// list — leave them crawlable with a noindex instead.
//
// See lib/seo.ts (isIndexingEnabled) for the real "don't index yet" switch,
// driven by NEXT_PUBLIC_ALLOW_INDEXING and independent of this file.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/keystatic",
        "/api",
        "/*/login",
        "/*/signup",
        "/*/planner",
        "/*/account",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
