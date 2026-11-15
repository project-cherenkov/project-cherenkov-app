# Email and domain: setup, checklist and rollout

Written 2026-11-14. Code wins: if this disagrees with `lib/email.ts`, `lib/auth.ts` or `lib/admin-guard.ts`, the code is right and this file should be corrected. How the flows behave is in [account-email-flows.md](account-email-flows.md); every variable is in [cherenkov-env-vars-guide.md](cherenkov-env-vars-guide.md).

## Sending identity

- The canonical site is `https://www.projectcherenkov.dev`.
- Mail is SENT from a subdomain: `EMAIL_FROM=Project Cherenkov <no-reply@mail.projectcherenkov.dev>`. Keeping sending on `mail.` leaves the root domain free to RECEIVE mail (the contact mailbox) without the two getting in each other's way.
- Replies: `no-reply` is not read. If replies should reach a person, set `EMAIL_REPLY_TO` to a monitored address. Unset means no Reply-To header is sent. The address is never hard-coded.
- The contact mailbox on the root domain is created by the owner. Until it exists, the contact address in `PRIVACY.md`, `content/legal/id/privacy.md`, `TERMS.md`, `content/legal/id/terms.md`, `content/team/index.json` (shown on the About page) and `public/.well-known/security.txt` reads `[PLACEHOLDER: contact email]`. Search the repo for that exact text and replace it in one pass. The footer link (`components/site/footer.tsx`) and `README.md` still use the old address and must be changed at the same time.

## Checklist before relying on email

Do these in order. Items 1 to 3 are done by the owner in the provider and DNS dashboards, not in this repository.

1. In Resend, add the domain `mail.projectcherenkov.dev` and wait until it shows as verified.
2. At the DNS host, add the records Resend shows for that domain, copied exactly. These include the SPF and DKIM records. Do not type them from memory.
3. Add a DMARC record at `_dmarc.mail.projectcherenkov.dev` (or at `_dmarc.projectcherenkov.dev` to cover both). A cautious start is a monitor-only policy: `v=DMARC1; p=none`. Tighten it only after reports show legitimate mail passing.
4. Confirm `RESEND_API_KEY` and `EMAIL_FROM` are set for Production and Preview, then redeploy (a running deployment does not pick up changed variables).
5. First-send test: on the live site use "Forgot password?" with an address you control. The email should arrive within a minute, not in spam, and the link should open `/id/reset-password` or `/en/reset-password` with a token.
6. Check the sending identity in the received message: the "from" shows `Project Cherenkov`, and (if set) replies go to `EMAIL_REPLY_TO`.

Where to read what happened:

- Resend dashboard: the Emails list shows delivered, bounced and complained messages for each send.
- Vercel: Project, Logs, filter for `[auth]`. A provider failure is logged as `[auth] reset email failed`, `[auth] verification email failed`, `[auth] delete-account email failed` or `[auth] password-changed email failed`. Failures are logged and never shown to the person, so the request looks successful to them whether or not the account exists.

## Rollout order for this change

This change makes editor access depend on a verified email address, adds database-backed rate limiting, and turns on self-serve account deletion. Do these steps in this order so no editor loses access and no auth request fails.

1. Apply migration `drizzle/0010_auth_rate_limit.sql` to the production database (`pnpm db:migrate` with the production `DATABASE_URL`) BEFORE deploying. Better Auth does not catch a failing rate-limit lookup, so deploying first without the table makes every auth request fail. If you must deploy first, set `AUTH_RATE_LIMIT_STORAGE=memory` for Production, deploy, apply the migration, then remove the variable and redeploy.
2. In Vercel, set `ALLOW_UNVERIFIED_EDITORS=true` for Production (and Preview if previews are used for editing). This is the temporary switch that keeps editors working while they verify.
3. Deploy.
4. Each editor signs in, opens the Account page and chooses "Send verification email", then opens the link in the email. Signing in with Google using the same address also verifies it. Confirm the Account page shows "Verified" and the role "Primus Inter Pares".
5. Once every editor in `ADMIN_EMAILS` shows as verified, delete `ALLOW_UNVERIFIED_EDITORS` and redeploy.
6. Test both sides: a verified editor still sees the Edit link and drafts; a throwaway account registered with an editor address but not verified does not.

Existing accounts: everyone verifies. There is no backfill that marks accounts verified. Because signing in does not require verification, nobody is locked out; ordinary accounts simply show "Not verified" on their Account page, and verification only matters for editor features. Editors can alternatively be marked verified directly in the database if the owner controls their mailboxes, but the email route is preferred because it proves the mailbox.

With email NOT configured (neither `RESEND_API_KEY` nor `EMAIL_FROM`), nothing here is enforced: sign-up, sign-in and editor access behave as they did before, and the reset, verification and deletion pages return 404.

## Preview deployments

`BETTER_AUTH_URL` is applied to Preview as well as Production, so it normally points at the live site. On a Vercel Preview deployment the app now uses that deployment's own host (`VERCEL_URL`) instead, so reset and verification links in preview emails stay on the preview and the preview's sign-in passes Better Auth's origin check. Production, local development and any other host still use `BETTER_AUTH_URL` exactly as set. If `VERCEL_URL` is not exposed to the function (Vercel's "Automatically expose System Environment Variables" setting), previews fall back to the old behaviour.

Google sign-in and the GitHub App callback are registered for the production host only, so on a preview deployment use email and password.

## Database notes

### How `pnpm db:migrate` works, and what deletes data

- `pnpm db:migrate` does NOT replay every file from `0000`. Drizzle records in the database which migrations have already been applied, compares that record with `drizzle/meta/_journal.json`, and runs only the ones not yet recorded. Running it again with nothing new does nothing.
- Migrations run in journal order (`0000`, `0001`, and so on). For this change that means `0010` on a database that already has `0009`.
- `0010_auth_rate_limit.sql` contains one statement, `CREATE TABLE "rate_limit"`. It adds a new empty table and does not read, change or delete any existing row. No migration in this change deletes users or any other data.
- `ON DELETE cascade` (a rule on foreign keys, set in earlier migrations) is not something a migration runs. It is a rule the database applies at the moment ONE user row is deleted: the rows that belong to that user go with it. The only thing that deletes a user in this change is a person confirming "Delete account" from their own Account page, through the emailed link.
- Migrations are not undone by running them again. Back up (or use a Neon branch) before applying anything to production if you want a way back.

- `drizzle/meta/` snapshots stop at `0005`, while the journal and SQL go on to `0010`. The migrations after `0005` were written by hand. `0010_auth_rate_limit.sql` was compared with what `drizzle-kit generate` emits for the same schema: the `rate_limit` table is identical. Running `drizzle-kit generate` without first bringing the snapshots up to date will re-emit changes from `0006` onward that are already applied. Inspect any generated file before keeping it.
- The `rate_limit` table keeps one row per client address and path and is not cleaned up automatically. Rows older than the longest window (one hour) have no effect, so they can be removed occasionally:

```sql
DELETE FROM rate_limit WHERE last_request < (extract(epoch FROM now()) * 1000) - 86400000;
```

## Related

- [account-email-flows.md](account-email-flows.md): what each email does, rate limits, rotating the Resend key.
- [security-headers.md](security-headers.md): the report-only Content-Security-Policy and `security.txt`.
- [seo-and-accessibility.md](seo-and-accessibility.md): indexing and the pre-launch checklist.
