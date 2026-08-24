// Absolute origin used for sitemap.xml, robots.txt, and Open Graph/metadata
// URLs — DEPLOYMENT-READINESS ADDITION, not part of the original spec.
// Nothing else in Phase 1 needs an absolute URL (next-intl's own Link/
// routing helpers in i18n/routing.ts handle everything relatively).
//
// Falls back to localhost so `pnpm build`/`pnpm dev` work with zero
// configuration, same pattern as KEYSTATIC_GITHUB_REPO's placeholder in
// keystatic.config.ts. Set NEXT_PUBLIC_SITE_URL once the real domain is
// known (see .env.example) — until then, sitemap.xml and Open Graph tags
// will contain localhost URLs, which is harmless (nothing external can
// reach them) but should be fixed before real launch.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
