import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_RATE_LIMIT_RULES, authRateLimitOptions } from "./auth-rate-limit";

describe("authRateLimitOptions", () => {
  it("stores counters in the database by default so limits hold across serverless instances", () => {
    expect(authRateLimitOptions({}).storage).toBe("database");
    expect(authRateLimitOptions({}).modelName).toBe("rateLimit");
  });

  it("AUTH_RATE_LIMIT_STORAGE=memory is the pre-migration escape hatch", () => {
    expect(authRateLimitOptions({ AUTH_RATE_LIMIT_STORAGE: "memory" }).storage).toBe("memory");
    expect(authRateLimitOptions({ AUTH_RATE_LIMIT_STORAGE: " Memory " }).storage).toBe("memory");
    expect(authRateLimitOptions({ AUTH_RATE_LIMIT_STORAGE: "database" }).storage).toBe("database");
  });

  it("keeps the same rules in both modes", () => {
    expect(authRateLimitOptions({ AUTH_RATE_LIMIT_STORAGE: "memory" }).customRules).toBe(AUTH_RATE_LIMIT_RULES);
  });
});

describe("AUTH_RATE_LIMIT_RULES", () => {
  it("has a rule for each abuse-prone endpoint", () => {
    for (const path of [
      "/request-password-reset",
      "/sign-in/email",
      "/sign-up/email",
      "/send-verification-email",
    ]) {
      expect(AUTH_RATE_LIMIT_RULES).toHaveProperty([path]);
    }
  });

  it("makes sending mail stricter than signing in (it costs email quota)", () => {
    const mail = AUTH_RATE_LIMIT_RULES["/request-password-reset"];
    expect(mail.max / mail.window).toBeLessThan(AUTH_RATE_LIMIT_RULES["/sign-in/email"].max / AUTH_RATE_LIMIT_RULES["/sign-in/email"].window);
  });

  it("is stricter over a minute than the library default of 3 requests per 10 s (18 a minute)", () => {
    const rule = AUTH_RATE_LIMIT_RULES["/sign-in/email"];
    expect((rule.max / rule.window) * 60).toBeLessThan(18);
  });
});

// The rules above are matched by exact path. This guards against the installed
// library renaming an endpoint, which would silently disable its rule.
describe("rule paths match the installed better-auth endpoints", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("every rule key is a real endpoint path", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-0000");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    const { auth } = await import("./auth");
    const api = auth.api as unknown as Record<string, { path?: string } | undefined>;
    const realPaths = new Set(
      Object.values(api)
        .map((endpoint) => endpoint?.path)
        .filter((path): path is string => typeof path === "string"),
    );
    for (const path of Object.keys(AUTH_RATE_LIMIT_RULES)) {
      expect(realPaths, `no endpoint at ${path}`).toContain(path);
    }
  });
});
