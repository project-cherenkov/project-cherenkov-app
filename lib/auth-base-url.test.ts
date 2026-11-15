import { describe, expect, it } from "vitest";
import { absoluteAuthUrl, resolveAuthBaseUrl } from "./auth-base-url";

const PROD = "https://www.projectcherenkov.dev";

describe("resolveAuthBaseUrl", () => {
  it("returns BETTER_AUTH_URL untouched in production", () => {
    expect(
      resolveAuthBaseUrl({ BETTER_AUTH_URL: PROD, VERCEL_ENV: "production", VERCEL_URL: "project-abc.vercel.app" }),
    ).toBe(PROD);
  });

  it("returns BETTER_AUTH_URL untouched locally and when nothing is set", () => {
    expect(resolveAuthBaseUrl({ BETTER_AUTH_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
    expect(resolveAuthBaseUrl({})).toBeUndefined();
  });

  it("uses the deployment's own host on a preview deployment", () => {
    expect(
      resolveAuthBaseUrl({ BETTER_AUTH_URL: PROD, VERCEL_ENV: "preview", VERCEL_URL: "project-git-feature-team.vercel.app" }),
    ).toBe("https://project-git-feature-team.vercel.app");
  });

  it("tolerates a scheme or trailing slash in VERCEL_URL", () => {
    expect(resolveAuthBaseUrl({ VERCEL_ENV: "preview", VERCEL_URL: "https://p.vercel.app/" })).toBe("https://p.vercel.app");
  });

  it("falls back to BETTER_AUTH_URL when a preview has no VERCEL_URL", () => {
    expect(resolveAuthBaseUrl({ BETTER_AUTH_URL: PROD, VERCEL_ENV: "preview" })).toBe(PROD);
    expect(resolveAuthBaseUrl({ BETTER_AUTH_URL: PROD, VERCEL_ENV: "preview", VERCEL_URL: "  " })).toBe(PROD);
  });

  it("only treats VERCEL_ENV=preview as a preview (development builds keep BETTER_AUTH_URL)", () => {
    expect(resolveAuthBaseUrl({ BETTER_AUTH_URL: PROD, VERCEL_ENV: "development", VERCEL_URL: "x.vercel.app" })).toBe(PROD);
  });
});

describe("absoluteAuthUrl", () => {
  it("joins a path onto the resolved origin", () => {
    expect(absoluteAuthUrl("/forgot-password", { BETTER_AUTH_URL: `${PROD}/` })).toBe(`${PROD}/forgot-password`);
  });
  it("falls back to NEXT_PUBLIC_SITE_URL, then to undefined", () => {
    expect(absoluteAuthUrl("/x", { NEXT_PUBLIC_SITE_URL: PROD })).toBe(`${PROD}/x`);
    expect(absoluteAuthUrl("/x", {})).toBeUndefined();
  });
});
