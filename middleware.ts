import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isAdminSurfaceEnabled } from "./lib/admin-guard";

const intlMiddleware = createIntlMiddleware(routing);

// The CMS "write surface" as a whole — see lib/admin-guard.ts for exactly
// why these routes are gated together as one unit, not individually.
const ADMIN_SURFACE_PREFIXES = ["/keystatic", "/api/keystatic", "/api/team-photo"];

function isAdminSurfacePath(pathname: string): boolean {
  return ADMIN_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
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
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminSurfacePath(pathname)) {
    if (!isAdminSurfaceEnabled()) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.next();
  }

  // Every other /api route (none exist today beyond the two above) stays
  // excluded from locale-prefixing, exactly as before.
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
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
