import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminEmail, isAdminSurfaceEnabled } from "./admin-guard";

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