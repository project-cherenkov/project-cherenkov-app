import { describe, expect, it } from "vitest";
import { emailForPasswordChange } from "./auth-notifications";

describe("emailForPasswordChange", () => {
  it("returns the address after a successful change-password", () => {
    expect(
      emailForPasswordChange({
        path: "/change-password",
        returned: { token: null, user: { id: "u1", email: "rina@example.com" } },
      }),
    ).toBe("rina@example.com");
  });

  it("sends nothing for any other endpoint", () => {
    const returned = { user: { email: "rina@example.com" } };
    for (const path of ["/sign-in/email", "/reset-password", "/set-password", "/get-session"]) {
      expect(emailForPasswordChange({ path, returned })).toBeNull();
    }
  });

  it("sends nothing when the change failed", () => {
    const failure = Object.assign(new Error("INVALID_PASSWORD"), { statusCode: 400 });
    expect(emailForPasswordChange({ path: "/change-password", returned: failure })).toBeNull();
  });

  it("sends nothing when the answer has no usable address", () => {
    for (const returned of [undefined, null, "ok", {}, { user: null }, { user: {} }, { user: { email: "" } }, { user: { email: 5 } }]) {
      expect(emailForPasswordChange({ path: "/change-password", returned })).toBeNull();
    }
  });
});
