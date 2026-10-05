// Account roles shown on the Account page. Pure, so it is testable and the
// wording lives in one place.
//
//   Inchoatus          signed in, no edit access
//   Primus Inter Pares signed in AND has edit access
//
// "Edit access" is the same rule the CMS write surface already uses: the
// account's email is in ADMIN_EMAILS (lib/admin-guard.ts isAdminEmail).
// Being able to open /keystatic additionally needs the deployment's
// Keystatic/GitHub setup; this role says who is ALLOWED to edit.
export const ACCOUNT_ROLES = ["inchoatus", "primus_inter_pares"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ROLE_LABELS: Record<AccountRole, string> = {
  inchoatus: "Inchoatus",
  primus_inter_pares: "Primus Inter Pares",
};

export function resolveRole(hasEditAccess: boolean): AccountRole {
  return hasEditAccess ? "primus_inter_pares" : "inchoatus";
}
