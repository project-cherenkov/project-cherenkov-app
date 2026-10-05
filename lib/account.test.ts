import { describe, expect, it } from "vitest";
import { buildAccountDetails } from "./account";
import { resolveRole, ROLE_LABELS } from "./account-roles";

const row = { name: "Rina", email: "rina@example.com", emailVerified: false, createdAt: new Date("2026-09-01T00:00:00Z") };

describe("account roles", () => {
  it("signed-in without edit access is Inchoatus", () => {
    expect(ROLE_LABELS[resolveRole(false)]).toBe("Inchoatus");
  });
  it("signed-in with edit access is Primus Inter Pares", () => {
    expect(ROLE_LABELS[resolveRole(true)]).toBe("Primus Inter Pares");
  });
});

describe("buildAccountDetails", () => {
  it("carries name, email and the role", () => {
    const d = buildAccountDetails(row, ["credential"], false);
    expect(d).toMatchObject({ name: "Rina", email: "rina@example.com", role: "inchoatus", hasEditAccess: false });
  });
  it("gives editors the higher role", () => {
    expect(buildAccountDetails(row, [], true).role).toBe("primus_inter_pares");
  });
  it("dedupes and sorts providers", () => {
    expect(buildAccountDetails(row, ["google", "credential", "google"], false).providers).toEqual(["credential", "google"]);
  });
});
