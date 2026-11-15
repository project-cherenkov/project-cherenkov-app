// T11. Runs after Better Auth has deleted a user.
//
// The user row is the root of everything personal: every table that points at
// it (account, session, planner, quiz, study sessions, companion, home picks,
// ...) is declared ON DELETE CASCADE in lib/db/schema.ts AND in the applied
// migrations, so deleting the row removes them. That was checked against
// drizzle/*.sql, not assumed.
//
// The one table that does not point at the user is `verification` (reset and
// delete-account tokens). Those rows carry the user id in `value`, so they are
// removed here instead of waiting to expire.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { verification } from "@/lib/db/schema";

export async function removeVerificationRowsForUser(userId: string): Promise<void> {
  await db.delete(verification).where(eq(verification.value, userId));
}
