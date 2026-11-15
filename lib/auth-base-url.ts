// T13. Which origin Better Auth uses for links, OAuth callbacks and its own
// origin check.
//
// Production (and local dev, and any other host) is unchanged: BETTER_AUTH_URL
// is returned exactly as given. On a Vercel PREVIEW deployment BETTER_AUTH_URL is
// normally inherited from production, so reset and verification links in preview
// emails would point at the live site, and the preview's own sign-in requests
// would fail the origin check. There the deployment's own host (VERCEL_URL) wins.
//
// If VERCEL_URL is not exposed to the function, this falls back to
// BETTER_AUTH_URL and preview behaves as it did before.
// Accepts process.env directly. Only the keys named below are read.
export type AuthBaseUrlEnv = Readonly<Record<string, string | undefined>> & {
  BETTER_AUTH_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};

export function resolveAuthBaseUrl(env: AuthBaseUrlEnv): string | undefined {
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    const host = env.VERCEL_URL.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (host) return `https://${host}`;
  }
  return env.BETTER_AUTH_URL;
}

// Absolute URL on the same origin, or undefined when no origin is configured.
export function absoluteAuthUrl(path: string, env: AuthBaseUrlEnv): string | undefined {
  const base = resolveAuthBaseUrl(env) ?? env.NEXT_PUBLIC_SITE_URL;
  if (!base) return undefined;
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
