import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reads the options the real lib/auth.ts hands to Better Auth. The instance is
// built lazily and cached, so each case resets modules first.
async function loadOptions(env: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-0000");
  vi.stubEnv("BETTER_AUTH_URL", "https://www.example.com");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
  vi.stubEnv("AUTH_RATE_LIMIT_STORAGE", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_URL", "");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { auth } = await import("./auth");
  return (auth as unknown as { options: AuthOptionsView }).options;
}

// Only the parts of Better Auth's options these tests read.
interface AuthOptionsView {
  baseURL?: string;
  emailVerification?: { sendOnSignUp?: boolean; sendVerificationEmail?: unknown };
  emailAndPassword: {
    requireEmailVerification?: boolean;
    revokeSessionsOnPasswordReset?: boolean;
    onPasswordReset?: unknown;
    sendResetPassword?: unknown;
    resetPasswordTokenExpiresIn?: number;
  };
  hooks?: { after?: unknown };
  account: { accountLinking: { trustedProviders?: string[] } };
  databaseHooks: { account: { create: { after?: unknown } } };
  rateLimit: { storage: string };
  user?: {
    deleteUser?: {
      enabled?: boolean;
      sendDeleteAccountVerification?: unknown;
      deleteTokenExpiresIn?: number;
    };
  };
}

const EMAIL = { RESEND_API_KEY: "re_test", EMAIL_FROM: "Cherenkov <no-reply@mail.example.com>" };

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("with email configured", () => {
  it("sends a verification email at signup but does not block sign-in (D1: Option B)", async () => {
    const o = await loadOptions(EMAIL);
    expect(o.emailVerification?.sendOnSignUp).toBe(true);
    expect(typeof o.emailVerification?.sendVerificationEmail).toBe("function");
    expect(o.emailAndPassword.requireEmailVerification).toBeUndefined();
  });

  it("revokes other sessions on reset and notifies on reset and change (T4, T5)", async () => {
    const o = await loadOptions(EMAIL);
    expect(o.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true);
    expect(typeof o.emailAndPassword.onPasswordReset).toBe("function");
    expect(o.hooks?.after).toBeDefined();
  });

  it("offers self-serve account deletion with an emailed confirmation (T11)", async () => {
    const o = await loadOptions(EMAIL);
    expect(o.user?.deleteUser?.enabled).toBe(true);
    expect(typeof o.user?.deleteUser?.sendDeleteAccountVerification).toBe("function");
    expect(o.user?.deleteUser?.deleteTokenExpiresIn).toBe(3600);
  });

  it("keeps the reset token lifetime at one hour", async () => {
    const o = await loadOptions(EMAIL);
    expect(o.emailAndPassword.resetPasswordTokenExpiresIn).toBe(3600);
  });
});

describe("with email NOT configured, behaviour is unchanged", () => {
  it("has no verification, reset, notification or after-hook", async () => {
    const o = await loadOptions({});
    expect(o.emailVerification?.sendVerificationEmail).toBeUndefined();
    expect(o.emailAndPassword.requireEmailVerification).toBeUndefined();
    expect(o.emailAndPassword.sendResetPassword).toBeUndefined();
    expect(o.emailAndPassword.onPasswordReset).toBeUndefined();
    expect(o.hooks?.after).toBeUndefined();
  });

  it("has no account deletion either", async () => {
    const o = await loadOptions({});
    expect(o.user?.deleteUser?.enabled).toBeFalsy();
  });
});

describe("account linking (T3)", () => {
  it("does not trust email-password as a linking provider", async () => {
    const o = await loadOptions(EMAIL);
    expect(o.account.accountLinking.trustedProviders ?? []).not.toContain("email-password");
  });

  it("installs the guard that drops an unverified password login when Google links", async () => {
    const o = await loadOptions(EMAIL);
    expect(typeof o.databaseHooks.account.create.after).toBe("function");
  });
});

describe("rate limiting (T7)", () => {
  it("uses database storage, and memory only through the escape hatch", async () => {
    expect((await loadOptions(EMAIL)).rateLimit.storage).toBe("database");
    expect((await loadOptions({ ...EMAIL, AUTH_RATE_LIMIT_STORAGE: "memory" })).rateLimit.storage).toBe("memory");
  });
});

describe("base URL (T13)", () => {
  it("is BETTER_AUTH_URL in production", async () => {
    const o = await loadOptions({ ...EMAIL, VERCEL_ENV: "production", VERCEL_URL: "x.vercel.app" });
    expect(o.baseURL).toBe("https://www.example.com");
  });

  it("is the preview host on a preview deployment", async () => {
    const o = await loadOptions({ ...EMAIL, VERCEL_ENV: "preview", VERCEL_URL: "x-git-y.vercel.app" });
    expect(o.baseURL).toBe("https://x-git-y.vercel.app");
  });
});
