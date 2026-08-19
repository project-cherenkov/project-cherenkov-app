import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on every route except Next internals, static files, and API routes
  // (Phase 2 auth will live under /api — keep it out of the locale prefix).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
