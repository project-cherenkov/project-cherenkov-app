// Server-side data for the Account page. Not a "use server" module: it takes a
// userId and must never be callable from the browser.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, user } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/admin-guard";
import { resolveRole, type AccountRole } from "@/lib/account-roles";

export interface AccountDetails {
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  role: AccountRole;
  hasEditAccess: boolean;
  // Better Auth provider ids, e.g. "credential" (email + password), "google".
  providers: string[];
}

export function buildAccountDetails(
  row: { name: string; email: string; emailVerified: boolean; createdAt: Date },
  providers: string[],
  hasEditAccess: boolean,
): AccountDetails {
  return {
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt,
    role: resolveRole(hasEditAccess),
    hasEditAccess,
    providers: [...new Set(providers)].sort(),
  };
}

export async function getAccountDetails(userId: string): Promise<AccountDetails | null> {
  const [row] = await db
    .select({
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return null;
  const accounts = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId));
  return buildAccountDetails(row, accounts.map((a) => a.providerId), isAdminEmail(row.email));
}
