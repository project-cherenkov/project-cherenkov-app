import { describe, expect, it } from "vitest";
import { buildGithubAuthorizeUrl, isGithubAuthRequiredError } from "./scene-builder-oauth-client";

describe("isGithubAuthRequiredError", () => {
  it("matches the /api/scene-builder/new error copy", () => {
    expect(
      isGithubAuthRequiredError(
        "GitHub authorization required. Visit /api/scene-builder/github-oauth/start, then try again.",
      ),
    ).toBe(true);
  });

  it("matches the /api/scene-builder (save) error copy, despite the different tail", () => {
    expect(
      isGithubAuthRequiredError(
        "GitHub authorization required. Visit /api/scene-builder/github-oauth/start, then try saving again.",
      ),
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isGithubAuthRequiredError("Content editor authorization required.")).toBe(false);
    expect(isGithubAuthRequiredError("Save failed — network error.")).toBe(false);
  });

  it("does not match null/undefined/non-string values", () => {
    expect(isGithubAuthRequiredError(undefined)).toBe(false);
    expect(isGithubAuthRequiredError(null)).toBe(false);
  });
});

describe("buildGithubAuthorizeUrl", () => {
  it("encodes returnTo as a query param on the start route", () => {
    expect(buildGithubAuthorizeUrl("/keystatic/scene-builder/new")).toBe(
      "/api/scene-builder/github-oauth/start?returnTo=%2Fkeystatic%2Fscene-builder%2Fnew",
    );
  });

  it("encodes a returnTo that carries its own query string", () => {
    expect(buildGithubAuthorizeUrl("/keystatic/scene-builder?subject=physics&slug=test")).toBe(
      "/api/scene-builder/github-oauth/start?returnTo=%2Fkeystatic%2Fscene-builder%3Fsubject%3Dphysics%26slug%3Dtest",
    );
  });
});
