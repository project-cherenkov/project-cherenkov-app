import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

type Auth = ReturnType<typeof betterAuth>;

let cached: Auth | null = null;

// AUTH-001. Lazily constructed for the same reason lib/db's `db` export is
// a Proxy rather than an eager client: this module is imported transitively
// by middleware.ts (via lib/auth-guard.ts), and Phase 1's own build must
// keep succeeding with zero env vars (spec §2). Constructing Better Auth
// eagerly at module load would read BETTER_AUTH_SECRET/GOOGLE_CLIENT_ID at
// import time instead of call time — this instead follows the same
// call-time-env-read idiom lib/admin-guard.ts already uses for
// KEYSTATIC_GITHUB_CLIENT_ID.
function getAuth(): Auth {
  if (cached) return cached;

  cached = betterAuth({
    // drizzleAdapter only touches `db` (itself a lazy Proxy — see
    // lib/db/index.ts) when Better Auth is actually asked to do something,
    // i.e. when a request reaches app/api/auth/[...all]/route.ts or a
    // Server Component/Action calls auth.api.getSession. Constructing the
    // adapter here doesn't itself open a connection.
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    // Decision #1 (user-confirmed): Google OAuth + email/password fallback,
    // no other providers.
    emailAndPassword: {
      enabled: true,
    },
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              // Standard minimal scope (AUTH-001 requirement) — decision #2
              // (only email + name collected/displayed) doesn't need
              // anything beyond this.
              scope: ["openid", "email", "profile"],
            },
          }
        : undefined,
  });

  return cached;
}

type AuthHandler = (request: Request) => Promise<Response>;

// Better Auth's Next.js adapter accepts either:
// 1) an object with a `handler` function, or
// 2) a function itself.
// The library's runtime check uses `"handler" in auth`, so the exported value
// must explicitly expose `handler` on the object itself. The rest of the
// instance remains lazily proxied so env reads happen only on first real use.
const authHandler: AuthHandler = (request) => getAuth().handler(request);

export const auth: Auth & { handler: AuthHandler } = new Proxy(
  { handler: authHandler } as Auth & { handler: AuthHandler },
  {
    get(target, prop, receiver) {
      if (prop === "handler") {
        return Reflect.get(target, prop, receiver);
      }
      return Reflect.get(getAuth(), prop, receiver);
    },
    has(target, prop) {
      if (prop === "handler") return true;
      return Reflect.has(getAuth(), prop) || Reflect.has(target, prop);
    },
  },
);
