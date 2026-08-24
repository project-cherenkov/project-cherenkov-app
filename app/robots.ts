import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// DEPLOYMENT-READINESS ADDITION, not part of the original spec — no
// robots.txt existed at all. /keystatic and /api are disallowed here as a
// second, independent layer on top of lib/admin-guard.ts's actual access
// control (a 404 doesn't need a disallow rule to be safe, but keeping
// well-behaved crawlers from even requesting it is good practice and
// costs nothing).
//
// See app/[locale]/layout.tsx's generateMetadata for why every page is
// ALSO marked noindex for now regardless of this file — that's the real
// "don't index yet" switch, driven by the placeholder copy in
// messages/*.json, and is independent of this file.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/keystatic", "/api"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
