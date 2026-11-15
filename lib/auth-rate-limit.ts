// T7. Rate limits for Better Auth, stored in the database.
//
// Better Auth's default limiter keeps its counters in process memory. On Vercel
// every serverless instance has its own memory, so a limit of N is really N per
// warm instance, and "forgot password" could be used to burn the email quota.
// With storage "database" the counters live in the rate_limit table (see
// drizzle/0010_auth_rate_limit.sql) and are shared by every instance.
//
// Keys are per client IP and per path. Rules are keyed by the exact endpoint
// path (without the /api/auth prefix); lib/auth-rate-limit.test.ts checks them
// against the endpoint paths of the installed library so a rename cannot
// silently turn a rule off.
//
// Numbers are deliberately not tiny: a school or campus shares one IP, and a
// whole class may sign up in the same lesson.
//
// Limits are per IP, so a caller rotating IPs can still exceed them in total.
// The email provider's own quota is the backstop.
export interface AuthRateLimitRule {
  window: number; // seconds
  max: number;
}

export const AUTH_RATE_LIMIT_RULES = {
  // Library default for sign-in / sign-up is 3 per 10 s, which resets quickly
  // enough to allow ~18 guesses a minute. These are the longer-window rules.
  "/sign-in/email": { window: 60, max: 5 },
  "/sign-up/email": { window: 3600, max: 10 },
  "/request-password-reset": { window: 3600, max: 5 },
  "/send-verification-email": { window: 3600, max: 5 },
  "/reset-password": { window: 600, max: 10 },
  "/delete-user": { window: 3600, max: 5 },
} satisfies Record<string, AuthRateLimitRule>;

// ROLLOUT: Better Auth does not catch a failing limiter lookup. If this ships
// before drizzle/0010_auth_rate_limit.sql is applied, EVERY auth request fails.
// Apply the migration first. AUTH_RATE_LIMIT_STORAGE=memory is the escape hatch:
// it switches back to the library's per-instance memory counters (same rules,
// weaker guarantee) without a code change, until the table exists.
export function authRateLimitOptions(env: Readonly<Record<string, string | undefined>> = process.env) {
  const useMemory = env.AUTH_RATE_LIMIT_STORAGE?.trim().toLowerCase() === "memory";
  return {
    storage: (useMemory ? "memory" : "database") as "memory" | "database",
    modelName: "rateLimit",
    customRules: AUTH_RATE_LIMIT_RULES,
  };
}
