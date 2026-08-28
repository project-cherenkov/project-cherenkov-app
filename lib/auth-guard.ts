import { headers as nextHeaders } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Single source of truth for whether a request carries a valid Better Auth
// session — in the same spirit as lib/admin-guard.ts's
// isAdminSurfaceEnabled() for the CMS write surface (AUTH-002 implementation
// requirement).
//
// Two entry points, one underlying check: middleware only has a
// NextRequest (request.headers); Server Components and Server Actions only
// have next/headers's async headers(). Both funnel through
// getSessionFromHeaders so there is exactly one place that ever calls
// auth.api.getSession.
async function getSessionFromHeaders(headers: Headers) {
  try {
    return await auth.api.getSession({ headers });
  } catch {
    // Fail closed: a DB error, an expired/malformed session cookie, or
    // DATABASE_URL simply being unset should all behave like "no session",
    // never like "authenticated" and never like an unhandled 500 on a
    // gated route. This also means /planner/** degrades to "always redirect
    // to /login" rather than 500ing if the database is briefly unreachable —
    // see the Remaining Risks note in the final report for that trade-off.
    return null;
  }
}

// Called from middleware.ts for any /[locale]/planner** request.
export async function hasValidSession(request: NextRequest): Promise<boolean> {
  const session = await getSessionFromHeaders(request.headers);
  return session !== null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

// For Server Components / Server Actions, which only have next/headers, not
// a NextRequest. Returns the minimal shape Phase 2 actually uses — decision
// #2: only email + name are collected/displayed; Better Auth's `image`
// field (populated by the Google adapter regardless) is deliberately never
// surfaced here.
//
// Defense-in-depth (spec §9 HIGH risk mitigation): middleware.ts's
// planner-auth branch already blocks unauthenticated requests before they
// reach a page, but every Server Action that touches per-user data
// (lib/quiz-actions.ts, lib/planner-actions.ts) also calls this directly and
// rejects on null, rather than trusting that middleware ran.
export async function getCurrentUser(): Promise<SessionUser | null> {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await getSessionFromHeaders(await nextHeaders());
  } catch {
    return null;
  }
  if (!session) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
