import { describe, expect, it, vi } from "vitest";
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

// T2: the Account page role must agree with the route guards.
describe("account role for an admin email", () => {
  it("is Inchoatus until the admin address is verified, Primus Inter Pares after", async () => {
    vi.resetModules();
    vi.stubEnv("ADMIN_EMAILS", "editor@example.com");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Cherenkov <no-reply@mail.example.com>");
    vi.stubEnv("ALLOW_UNVERIFIED_EDITORS", "");
    let verified = false;
    vi.doMock("@/lib/db", () => ({
      db: {
        select: () => ({
          from: (table: { providerId?: unknown }) => ({
            where: () => {
              const rows = table && "providerId" in table
                ? [{ providerId: "credential" }]
                : [{ name: "Ed", email: "editor@example.com", emailVerified: verified, createdAt: new Date("2026-09-01T00:00:00Z") }];
              return Object.assign(Promise.resolve(rows), { limit: async () => rows });
            },
          }),
        }),
      },
    }));
    const { getAccountDetails } = await import("./account");

    expect((await getAccountDetails("u1"))?.role).toBe("inchoatus");
    expect((await getAccountDetails("u1"))?.hasEditAccess).toBe(false);
    verified = true;
    expect((await getAccountDetails("u1"))?.role).toBe("primus_inter_pares");

    vi.doUnmock("@/lib/db");
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
