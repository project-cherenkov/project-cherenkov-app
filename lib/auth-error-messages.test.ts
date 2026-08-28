import { describe, expect, it } from "vitest";
import { classifyAuthError, classifyCallbackError } from "./auth-error-messages";

describe("classifyAuthError", () => {
  it("classifies a thrown TypeError (failed fetch) as network", () => {
    expect(classifyAuthError(new TypeError("Failed to fetch"))).toBe(
      "network",
    );
  });

  it("classifies an unrecognized thrown Error as unknown, not network", () => {
    // AUTH-003: only TypeError is trusted as a network signal — any other
    // thrown Error shouldn't be guessed at.
    expect(classifyAuthError(new Error("boom"))).toBe("unknown");
  });

  it("classifies a non-object, non-Error value as unknown", () => {
    expect(classifyAuthError(undefined)).toBe("unknown");
    expect(classifyAuthError("some string")).toBe("unknown");
  });

  it("classifies status 429 as rateLimited", () => {
    expect(classifyAuthError({ status: 429, message: "Too many requests" })).toBe(
      "rateLimited",
    );
  });

  it("classifies a rate_limit error code as rateLimited even without status 429", () => {
    expect(classifyAuthError({ code: "RATE_LIMIT_EXCEEDED" })).toBe(
      "rateLimited",
    );
  });

  it("classifies an 'already exists' message as accountExists", () => {
    expect(
      classifyAuthError({
        status: 422,
        message: "An account with this email already exists",
      }),
    ).toBe("accountExists");
  });

  it("classifies an account_not_linked code as accountExists", () => {
    expect(classifyAuthError({ code: "ACCOUNT_NOT_LINKED" })).toBe(
      "accountExists",
    );
  });

  it("classifies a provider-not-enabled message as notConfigured", () => {
    expect(
      classifyAuthError({
        status: 400,
        message: "Provider google is not enabled",
      }),
    ).toBe("notConfigured");
  });

  it("classifies status 401/403 as denied", () => {
    expect(classifyAuthError({ status: 401 })).toBe("denied");
    expect(classifyAuthError({ status: 403 })).toBe("denied");
  });

  it("classifies any 5xx as misconfigured", () => {
    expect(classifyAuthError({ status: 500 })).toBe("misconfigured");
    expect(classifyAuthError({ status: 503 })).toBe("misconfigured");
  });

  it("classifies an unrecognized 4xx as server", () => {
    expect(classifyAuthError({ status: 418 })).toBe("server");
  });

  it("classifies a structured error with no status/message/code as unknown", () => {
    expect(classifyAuthError({})).toBe("unknown");
  });
});

describe("classifyCallbackError", () => {
  it("classifies Google's standard access_denied value as denied", () => {
    expect(classifyCallbackError("access_denied")).toBe("denied");
  });

  it("is case-insensitive", () => {
    expect(classifyCallbackError("ACCESS_DENIED")).toBe("denied");
  });

  it("classifies account_not_linked / email_exists as accountExists", () => {
    expect(classifyCallbackError("account_not_linked")).toBe("accountExists");
    expect(classifyCallbackError("email_exists")).toBe("accountExists");
  });

  it("classifies a configuration-flavored value as notConfigured", () => {
    expect(classifyCallbackError("provider_not_configured")).toBe(
      "notConfigured",
    );
  });

  it("falls back to unknown for an unrecognized value", () => {
    expect(classifyCallbackError("some_future_error_code")).toBe("unknown");
  });
});
