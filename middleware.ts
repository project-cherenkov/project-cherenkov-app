import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on every route except Next internals, static files, API routes
  // (Phase 2 auth will live under /api — keep it out of the locale prefix),
  // and /keystatic — the admin shell must load at /keystatic directly, not
  // get locale-prefixed to /id/keystatic or /en/keystatic (spec §11
  // CMS-004).
  matcher: ["/((?!api|_next|_vercel|keystatic|.*\\..*).*)"],
};
