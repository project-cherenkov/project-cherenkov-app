// T5. Decides whether a finished auth request should trigger the
// "your password was changed" notice. Kept separate from lib/auth.ts so the rule
// can be unit-tested without a Better Auth instance or a database.
//
// Better Auth has a callback for password RESET (onPasswordReset) but none for
// change-password, so that one is handled from an after-hook: the hook sees the
// endpoint's own answer, which for a successful change carries the user.
export const CHANGE_PASSWORD_PATH = "/change-password";

export function emailForPasswordChange(input: { path: string; returned: unknown }): string | null {
  if (input.path !== CHANGE_PASSWORD_PATH) return null;
  // A failed change (wrong current password, too short, ...) comes back as an
  // error object, not as { user }. No notice for those.
  if (input.returned instanceof Error) return null;
  if (typeof input.returned !== "object" || input.returned === null) return null;
  const user = (input.returned as { user?: unknown }).user;
  if (typeof user !== "object" || user === null) return null;
  const email = (user as { email?: unknown }).email;
  return typeof email === "string" && email.length > 0 ? email : null;
}
