import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGithubOauthState,
  readCookie,
  readGithubToken,
  signGithubToken,
  verifyGithubOauthState,
} from "./scene-builder-oauth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("readCookie", () => {
  it("finds a named cookie among several", () => {
    const header = "a=1; scene_builder_gh_token=abc.def; other=xyz";
    expect(readCookie(header, "scene_builder_gh_token")).toBe("abc.def");
  });

  it("returns undefined when the cookie is absent", () => {
    expect(readCookie("a=1; b=2", "scene_builder_gh_token")).toBeUndefined();
  });

  it("decodes a URI-encoded value", () => {
    const header = `token=${encodeURIComponent("a b/c")}`;
    expect(readCookie(header, "token")).toBe("a b/c");
  });
});

describe("GitHub token cookie", () => {
  it("round-trips a signed token", () => {
    const cookieValue = signGithubToken("gho_abc123");
    expect(readGithubToken(cookieValue)).toBe("gho_abc123");
  });

  it("rejects a tampered cookie value", () => {
    const cookieValue = signGithubToken("gho_abc123");
    const tampered = cookieValue.slice(0, -1) + (cookieValue.endsWith("A") ? "B" : "A");
    expect(readGithubToken(tampered)).toBeNull();
  });

  it("rejects a value signed with a different secret", () => {
    vi.stubEnv("KEYSTATIC_SECRET", "secret-one");
    const cookieValue = signGithubToken("gho_abc123");
    vi.stubEnv("KEYSTATIC_SECRET", "secret-two");
    expect(readGithubToken(cookieValue)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const cookieValue = signGithubToken("gho_abc123");
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z")); // TTL is 1 hour
    expect(readGithubToken(cookieValue)).toBeNull();
  });

  it("rejects garbage input without throwing", () => {
    expect(readGithubToken("not-a-signed-value")).toBeNull();
    expect(readGithubToken(undefined)).toBeNull();
    expect(readGithubToken("")).toBeNull();
  });
});

describe("OAuth state cookie (CSRF check)", () => {
  it("verifies a matching state", () => {
    const { state, cookieValue } = createGithubOauthState();
    expect(verifyGithubOauthState(cookieValue, state)).toBe(true);
  });

  it("rejects a mismatched state", () => {
    const { cookieValue } = createGithubOauthState();
    expect(verifyGithubOauthState(cookieValue, "some-other-state")).toBe(false);
  });

  it("rejects a missing state param", () => {
    const { cookieValue } = createGithubOauthState();
    expect(verifyGithubOauthState(cookieValue, undefined)).toBe(false);
  });

  it("rejects when the cookie itself is missing", () => {
    const { state } = createGithubOauthState();
    expect(verifyGithubOauthState(undefined, state)).toBe(false);
  });

  it("two calls mint different, unpredictable state values", () => {
    const a = createGithubOauthState();
    const b = createGithubOauthState();
    expect(a.state).not.toBe(b.state);
  });
});
