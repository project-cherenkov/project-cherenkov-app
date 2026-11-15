# Account email flows

Written 2026-11-14. Code wins: see `lib/auth.ts`, `lib/email.ts`, `lib/email-templates.ts`, `lib/auth-linking.ts` and `lib/admin-guard.ts`. Setup and rollout are in [email-and-domain.md](email-and-domain.md).

All of this exists only when outgoing email is configured (`RESEND_API_KEY` and `EMAIL_FROM`). Without them signup and sign-in work as before and the pages below return 404.

## Email verification

- Signing up sends a verification email. The link is valid for 24 hours and lands on `/[locale]/email-verified`, which shows success, "expired" or "invalid".
- Signing in does NOT require a verified address. Verification gates privileged features only: editor access (Edit link, draft editorials and materials, Keystatic quiz bank, scene builder, team-photo upload) and the "Primus Inter Pares" role. An address on `ADMIN_EMAILS` that is not verified is treated as an ordinary account.
- The Account page shows "Verified" or "Not verified" and, when not verified, a button to send the email again.
- Google sign-in reports whether Google has verified the address. Better Auth records that, so those accounts are verified, and linking Google to an existing account marks it verified.

## Password reset

1. "Forgot password?" on the login page asks for an address and always answers the same way, whether or not an account exists.
2. If one does, a link valid for one hour opens `/[locale]/reset-password`.
3. Setting the new password signs out every session that was open, then sends a "your password was changed" notice. The notice says when it happened (UTC) and what to do if it was not the owner. It never contains a password or a token.

An account created with Google has no password. It can set one the same way, from the Account page, which sends the reset link.

## Change password

On the Account page: enter the current password and a new one. All other sessions are signed out, this device stays signed in, and the same "password was changed" notice is sent. A wrong current password changes nothing and sends nothing.

## Account deletion

On the Account page, in two steps. Step one asks for a confirmation email (accounts with a password also type it). Step two is the emailed link, valid for one hour, which deletes the account only while signed in as that same account. Deleting the user removes the account, sessions, planner, quiz, study-session, companion and home-pick rows by `ON DELETE CASCADE`; this was checked against the applied migrations in `drizzle/`. Leftover reset and deletion tokens are removed afterwards.

## Account linking

Google links to an existing account only when Google itself reports the address as verified. If someone registered an address by password and never verified it, and the real owner later signs in with Google, the unverified password login is removed and every session of that account is signed out (`lib/auth-linking.ts`). This stops a pre-registration takeover. The visible effect on a genuine user: someone who signed up with a password, never verified, then used Google with the same address uses Google (or "Forgot password?") from then on.

## Rate limits

Counters live in the database table `rate_limit`, per client IP and path, so they hold across serverless instances. Rules are in `lib/auth-rate-limit.ts`:

| Endpoint | Limit |
| --- | --- |
| sign in | 5 per minute |
| sign up | 10 per hour |
| forgot password | 5 per hour |
| resend verification | 5 per hour |
| reset password | 10 per 10 minutes |
| delete account | 5 per hour |

Limits are per IP, so a school or campus sharing one address shares the limit. A caller who rotates addresses can exceed them in total; the email provider's own quota is the backstop.

## Rotating the Resend API key

Do this on a schedule, or immediately if the key may have leaked.

1. In Resend, create a new API key. Prefer the narrowest permission that allows sending, restricted to the sending domain if the dashboard offers that.
2. In Vercel, replace `RESEND_API_KEY` for Production and Preview with the new value. Mark it Sensitive.
3. Redeploy. A running deployment keeps the old value until it is replaced.
4. Test: use "Forgot password?" with an address you control and confirm the email arrives (see the checklist in [email-and-domain.md](email-and-domain.md)).
5. Only after the test passes, delete the old key in Resend. If the old key leaked, delete it first and accept a short gap in email.

Never paste the key into the repository, an issue, a log line or a chat. The code never prints it.
