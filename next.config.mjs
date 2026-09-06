import createNextIntlPlugin from "next-intl/plugin";

// Points next-intl at the request-time config (locale detection, message loading).
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // BUGFIX (production edit surface was unreachable — see chat thread):
  // keystatic.config.ts branches its `storage` field on whether GitHub
  // mode is configured, and that file is bundled into the BROWSER too
  // (app/keystatic/keystatic.ts, a "use client" component, imports it
  // directly). The underlying signal, KEYSTATIC_GITHUB_CLIENT_ID, is a
  // server-only var — Next never inlines a value for it into client code,
  // so the browser always saw `undefined` there regardless of what was
  // actually configured on the server, and always fell back to `local`
  // storage client-side while the server correctly ran `github` mode.
  // That mismatch is why /keystatic never showed a "Sign in with GitHub"
  // screen, and why every collection/singleton load failed.
  //
  // Fix: mirror the same boolean into a client-visible var, computed here
  // at build time (where the real server env var IS available) rather
  // than as a second value someone has to remember to set and keep in
  // sync in Vercel. One source of truth: KEYSTATIC_GITHUB_CLIENT_ID.
  env: {
    NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED: process.env.KEYSTATIC_GITHUB_CLIENT_ID
      ? "1"
      : "",
  },
  // Velite writes generated content types/data into .velite/ at dev/build
  // time. It's run alongside Next via `concurrently` in package.json's
  // "dev"/"build" scripts, NOT through Velite's Next.js plugin hook — kept
  // as two plain, visible commands rather than a config-level integration,
  // so it's obvious to a new contributor what's actually running.
  //
  // DEVIATION from spec §11 CMS-005: the spec calls for composing a
  // `withKeystatic()` wrapper here alongside `withNextIntl()`. The
  // installed @keystatic/next (5.0.5) has no such export — confirmed
  // against the package's actual exports map (`./api`, `./ui/app`,
  // `./ui/pages`, `./route-handler`, `./reader-refresh` only; nothing that
  // wraps next.config). This version of Keystatic needs no Next config
  // integration at all: the admin UI is a plain page
  // (app/keystatic/[[...params]]/page.tsx using `makePage()`) and the API
  // route is a plain route handler
  // (app/api/keystatic/[...params]/route.ts using `makeRouteHandler()`).
  // next.config.mjs is intentionally left unmodified — there is nothing
  // for it to compose. Flagged here rather than inventing a wrapper
  // function that doesn't exist just to satisfy the spec's literal wording.
  experimental: {
    // MDX-derived pages can be heavy; keeps per-editorial bundles isolated
    // rather than pulled into a shared chunk (Non-Functional Requirements §8).
    optimizePackageImports: ["d3", "lucide-react"],
  },

  // DEPLOYMENT-READINESS ADDITION, not part of the original spec: baseline
  // response headers, applied to every route. None of this is specific to
  // Cherenkov's own architecture — it's the standard low-risk hardening
  // any public Vercel deployment should ship with, and doesn't constrain
  // anything Phase 1 or Phase 2 currently do (no third-party embeds, no
  // iframes, no inline-script requirements beyond what Next.js itself
  // emits). Deliberately NOT included: a Content-Security-Policy — a real
  // one needs to be worked out against Keystatic's admin UI and Vercel
  // Blob's image host, which is a bigger, separate decision (Recommended,
  // not Required, for this pass — see docs/deployment-readiness.md).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
