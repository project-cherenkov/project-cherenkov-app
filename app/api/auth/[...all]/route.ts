import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth's own required integration point (spec §4) — this is not a
// custom route, just the adapter Better Auth's docs specify for the Next.js
// App Router. Every /api/auth/* request (sign-in, sign-up, OAuth callback,
// session, sign-out) is delegated to lib/auth.ts's config.
//
// UNVERIFIED (same gap as lib/db/schema.ts's header comment): the
// `better-auth/next-js` import path is Better Auth's documented v1.x
// integration point, but this environment has no network access to confirm
// it against the actually-installed version. Verify alongside the schema
// check before deploying.
export const { GET, POST } = toNextJsHandler(auth);
