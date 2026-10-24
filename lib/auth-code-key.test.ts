import { describe, expect, it } from "vitest";
import { authCodeKey } from "./auth-error-messages";

describe("authCodeKey", () => {
  it("maps known Better Auth codes to translation keys", () => {
    expect(authCodeKey("INVALID_EMAIL_OR_PASSWORD")).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect(authCodeKey("PASSWORD_TOO_SHORT")).toBe("PASSWORD_TOO_SHORT");
  });

  it("is case-insensitive", () => {
    expect(authCodeKey("invalid_token")).toBe("INVALID_TOKEN");
  });

  it("resolves renamed variants by prefix", () => {
    expect(authCodeKey("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")).toBe("USER_ALREADY_EXISTS");
  });

  it("does not take INVALID_EMAIL_OR_PASSWORD for INVALID_EMAIL", () => {
    expect(authCodeKey("INVALID_EMAIL_OR_PASSWORD")).not.toBe("INVALID_EMAIL");
    expect(authCodeKey("INVALID_EMAIL")).toBe("INVALID_EMAIL");
  });

  it("returns null for unknown or non-string codes so callers fall back to the message", () => {
    expect(authCodeKey("SOMETHING_NEW")).toBeNull();
    expect(authCodeKey(undefined)).toBeNull();
    expect(authCodeKey(42)).toBeNull();
  });
});
