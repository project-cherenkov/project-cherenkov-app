import { afterEach, describe, expect, it, vi } from "vitest";
import { editorsMustVerifyEmail, isAdminEmail, isAdminSurfaceEnabled, isVerifiedAdmin } from "./admin-guard";

describe("isAdminEmail", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("matches normalized allow-listed emails", () => {
    process.env.ADMIN_EMAILS = "editor@example.com, second@example.com";
    expect(isAdminEmail(" EDITOR@EXAMPLE.COM ")).toBe(true);
    expect(isAdminEmail("student@example.com")).toBe(false);
  });

  it("fails closed when no allow-list is configured", () => {
    expect(isAdminEmail("editor@example.com")).toBe(false);
  });
});

// CH-03 (architect audit round 1): a deployment that sets
// KEYSTATIC_GITHUB_CLIENT_ID (enabling GitHub-mode admin access) but omits
// KEYSTATIC_SECRET must NOT have the admin surface reachable — otherwise
// every signed OAuth-state/GitHub-token cookie in
// lib/scene-builder-oauth.ts falls back to a hardcoded, publicly-known
// secret string.
describe("isAdminSurfaceEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays enabled in non-production regardless of secret/client-id (existing dev-mode behavior)", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "");
    vi.stubEnv("KEYSTATIC_SECRET", "");
    expect(isAdminSurfaceEnabled()).toBe(true);
  });

  it("stays disabled in production when neither var is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "");
    vi.stubEnv("KEYSTATIC_SECRET", "");
    expect(isAdminSurfaceEnabled()).toBe(false);
  });

  it("fails closed in production when KEYSTATIC_GITHUB_CLIENT_ID is set but KEYSTATIC_SECRET is not", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "client-id");
    vi.stubEnv("KEYSTATIC_SECRET", "");
    expect(isAdminSurfaceEnabled()).toBe(false);
  });

  it("is enabled in production when both KEYSTATIC_GITHUB_CLIENT_ID and KEYSTATIC_SECRET are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "client-id");
    vi.stubEnv("KEYSTATIC_SECRET", "a-real-secret");
    expect(isAdminSurfaceEnabled()).toBe(true);
  });
});
// T2: the allow-list matches an ADDRESS, and anyone can register any address, so
// an editor only counts once that address is verified.
describe("isVerifiedAdmin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function configureEmailAndAdmin() {
    vi.stubEnv("ADMIN_EMAILS", "editor@example.com");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Cherenkov <no-reply@mail.example.com>");
    vi.stubEnv("ALLOW_UNVERIFIED_EDITORS", "");
  }

  it("denies an admin email whose address is not verified", () => {
    configureEmailAndAdmin();
    expect(isVerifiedAdmin({ email: "editor@example.com", emailVerified: false })).toBe(false);
  });

  it("allows a verified admin email, ignoring case and spacing", () => {
    configureEmailAndAdmin();
    expect(isVerifiedAdmin({ email: " Editor@Example.com ", emailVerified: true })).toBe(true);
  });

  it("denies a verified address that is not on the allow-list", () => {
    configureEmailAndAdmin();
    expect(isVerifiedAdmin({ email: "student@example.com", emailVerified: true })).toBe(false);
  });

  it("fails closed with no allow-list, verified or not", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(isVerifiedAdmin({ email: "editor@example.com", emailVerified: true })).toBe(false);
  });

  it("does not require verification when email is not configured, so such a deployment behaves as before", () => {
    vi.stubEnv("ADMIN_EMAILS", "editor@example.com");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    expect(editorsMustVerifyEmail()).toBe(false);
    expect(isVerifiedAdmin({ email: "editor@example.com", emailVerified: false })).toBe(true);
  });

  it("ALLOW_UNVERIFIED_EDITORS=true is the temporary rollout switch", () => {
    configureEmailAndAdmin();
    vi.stubEnv("ALLOW_UNVERIFIED_EDITORS", "true");
    expect(editorsMustVerifyEmail()).toBe(false);
    expect(isVerifiedAdmin({ email: "editor@example.com", emailVerified: false })).toBe(true);
    // The switch never widens who is an editor.
    expect(isVerifiedAdmin({ email: "student@example.com", emailVerified: false })).toBe(false);
  });

  it("only the exact value \"true\" turns the switch on", () => {
    configureEmailAndAdmin();
    for (const value of ["1", "yes", "false", "TRUEISH"]) {
      vi.stubEnv("ALLOW_UNVERIFIED_EDITORS", value);
      expect(isVerifiedAdmin({ email: "editor@example.com", emailVerified: false })).toBe(false);
    }
  });
});
