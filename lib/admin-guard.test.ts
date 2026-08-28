import { afterEach, describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin-guard";

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