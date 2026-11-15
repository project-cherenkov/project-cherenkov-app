// T3. Pre-registration takeover guard.
//
// The attack: someone registers victim@x.com by password. The address is never
// verified (signing in works without it), but the row exists. Later the real
// owner signs in with Google for the same address. Better Auth links Google to
// the EXISTING user row and marks the address verified, and the attacker's
// password credential is left on the account, so the attacker still holds a
// working login to an account that now looks verified and owned by the victim.
//
// The fix: the moment a non-password sign-in method is attached to a user whose
// address was NOT yet verified, drop that user's password credential and sign
// out every session. Whoever proved the mailbox (the Google sign-in) keeps the
// account; anything set up while it was unverified does not survive. The real
// owner can set a new password later with "Forgot password?".
//
// Visible effect for a genuine user: someone who signed up with a password,
// never verified, then used Google with the same address loses that password
// and uses Google (or Forgot password) from then on.
//
// This runs inside Better Auth's account-create hook, which fires before the
// library marks the address verified. Verified users and brand-new Google
// sign-ups (whose row is created already verified) are untouched.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, session, user } from "@/lib/db/schema";

export interface LinkingStore {
  isEmailVerified(userId: string): Promise<boolean>;
  removePasswordLoginAndSessions(userId: string): Promise<void>;
}

export const PASSWORD_PROVIDER_ID = "credential";

export function shouldPurgePasswordOnLink(input: {
  providerId: string;
  userEmailVerified: boolean;
}): boolean {
  return input.providerId !== PASSWORD_PROVIDER_ID && !input.userEmailVerified;
}

export async function handleAccountCreated(
  created: { providerId: string; userId: string },
  store: LinkingStore,
): Promise<boolean> {
  if (created.providerId === PASSWORD_PROVIDER_ID) return false;
  const verified = await store.isEmailVerified(created.userId);
  if (!shouldPurgePasswordOnLink({ providerId: created.providerId, userEmailVerified: verified })) {
    return false;
  }
  await store.removePasswordLoginAndSessions(created.userId);
  return true;
}

export const dbLinkingStore: LinkingStore = {
  async isEmailVerified(userId) {
    const [row] = await db
      .select({ verified: user.emailVerified })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.verified === true;
  },
  async removePasswordLoginAndSessions(userId) {
    await db
      .delete(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, PASSWORD_PROVIDER_ID)));
    await db.delete(session).where(eq(session.userId, userId));
  },
};
