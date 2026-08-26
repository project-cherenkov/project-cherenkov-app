import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isAdminSurfaceEnabled } from "./lib/admin-guard";
import { hasValidSession } from "./lib/auth-guard";

const intlMiddleware = createIntlMiddleware(routing);

// COMPATIBILITY FIX (phase-2 patch application): hasValidSession() (via
// lib/auth-guard.ts) imports the full Better Auth server instance
// (lib/auth.ts), not just a lightweight cookie check. Better Auth's server
// build pulls in Node-only code (its telemetry module uses dynamic code
// evaluation), which the default Edge middleware runtime rejects at build
// time ("Dynamic Code Evaluation ... not allowed in Edge Runtime"). Next.js
// 15.5 stabilized Node.js as a middleware runtime option — opting in here
// keeps auth-guard.ts's real getSession() DB check (rather than trading it
// for a cookie-presence-only check), at the cost of middleware no longer
// running on the Edge network for this project.
export const runtime = "nodejs";

// The CMS "write surface" as a whole — see lib/admin-guard.ts for exactly
// why these routes are gated together as one unit, not individually.
const ADMIN_SURFACE_PREFIXES = ["/keystatic", "/api/keystatic", "/api/team-photo"];

function isAdminSurfacePath(pathname: string): boolean {
  return ADMIN_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// AUTH-002: the study-planner "gated surface", alongside (not replacing)
// ADMIN_SURFACE_PREFIXES above. Every /[locale]/planner path must carry a
// valid Better Auth session — spec §2, §5, §6.
const PLANNER_GATED_PREFIXES = ["/planner"];

// Strips a leading /<locale> segment if present, so the planner check works
// the same way whether the request already has a locale prefix
// (/id/planner) or not (a bare /planner request that next-intl's own
// middleware would otherwise locale-prefix first).
function stripLocalePrefix(pathname: string): {
  locale: string | null;
  rest: string;
} {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return { locale, rest: "/" };
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, rest: pathname.slice(`/${locale}`.length) };
    }
  }
  return { locale: null, rest: pathname };
}

function isPlannerPath(pathname: string): boolean {
  const { rest } = stripLocalePrefix(pathname);
  return PLANNER_GATED_PREFIXES.some(
    (prefix) => rest === prefix || rest.startsWith(`${prefix}/`),
  );
}

// DEPLOYMENT-READINESS FIX, not part of the original spec: previously this
// file only ran next-intl's locale middleware, with /api and /keystatic
// excluded from its matcher entirely (comment below explains why they stay
// excluded from locale-prefixing specifically). That left nothing at all
// checking whether the admin surface should be reachable — see
// lib/admin-guard.ts for the risk this closes. Widening the matcher to
// include those paths and branching here (rather than editing each of the
// four admin route/page files individually) keeps the gate in one place,
// keeps this a "smallest coherent change," and runs the check at the edge
// before a request ever reaches Keystatic's own handler.
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminSurfacePath(pathname)) {
    if (!isAdminSurfaceEnabled()) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.next();
  }

  // Every other /api route (/api/auth/** as of AUTH-001, plus the two
  // admin-surface ones above) stays excluded from locale-prefixing, exactly
  // as before.
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // AUTH-002: planner-auth branch. Redirect, don't render partial data and
  // don't 404 (spec §2, §5, §6) — checked before intlMiddleware so a bare
  // /planner request (no locale prefix yet) is caught in the same pass as a
  // locale-prefixed one, in one redirect instead of two.
  if (isPlannerPath(pathname)) {
    const authed = await hasValidSession(request);
    if (!authed) {
      const { locale } = stripLocalePrefix(pathname);
      const loginUrl = new URL(
        `/${locale ?? routing.defaultLocale}/login`,
        request.url,
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Run on every route except Next internals and static files. /api and
  // /keystatic used to be excluded here too (the admin shell must load at
  // /keystatic directly, not get locale-prefixed to /id/keystatic or
  // /en/keystatic — spec §11 CMS-004); they're included now so the
  // admin-surface gate above can run on them, and the function itself
  // routes them away from intlMiddleware before any locale logic applies.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
