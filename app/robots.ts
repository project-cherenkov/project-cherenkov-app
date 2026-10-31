import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Crawler rules. /keystatic and /api are disallowed as a second layer on top
// of lib/admin-guard.ts's real access control; the account-only pages carry no
// search value and are also marked noindex in their own metadata. Do NOT add
// pages you want REMOVED from search results here: a blocked page can never
// have its noindex read. See lib/seo.ts (isIndexingEnabled) for the real
// "don't index yet" switch.
//
// AI crawlers. Two different things are controlled here, and they are separate
// decisions:
//  - SEARCH / ANSWER bots fetch pages so an assistant can cite you
//    (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User).
//    They are left allowed: being cited is the point of AI search visibility.
//  - TRAINING bots collect pages to train models (GPTBot, ClaudeBot,
//    Google-Extended, Applebot-Extended, CCBot, Bytespider, meta-externalagent).
//    Default is to allow (the behaviour before this file named them). Set
//    AI_TRAINING_CRAWLERS=disallow to opt the site out of training; this does
//    not affect Google or Bing search ranking. robots.txt is a request, not an
//    enforcement mechanism.
const TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
];

const DISALLOWED = [
  "/keystatic",
  "/api",
  "/*/login",
  "/*/signup",
  "/*/planner",
  "/*/account",
];

export default function robots(): MetadataRoute.Robots {
  const blockTraining = process.env.AI_TRAINING_CRAWLERS === "disallow";
  const rules: MetadataRoute.Robots["rules"] = [
    { userAgent: "*", allow: "/", disallow: DISALLOWED },
  ];
  if (blockTraining) rules.push({ userAgent: TRAINING_BOTS, disallow: "/" });
  return { rules, sitemap: `${siteUrl}/sitemap.xml` };
}
