import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createAuthMiddleware } from "better-auth/api";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  deleteAccountEmail,
  passwordChangedEmail,
  resetPasswordEmail,
  verificationEmail,
  type EmailContent,
} from "@/lib/email-templates";
import { absoluteAuthUrl, resolveAuthBaseUrl } from "@/lib/auth-base-url";
import { dbLinkingStore, handleAccountCreated } from "@/lib/auth-linking";
import { authRateLimitOptions } from "@/lib/auth-rate-limit";
import { emailForPasswordChange } from "@/lib/auth-notifications";
import { removeVerificationRowsForUser } from "@/lib/account-deletion";

type Auth = ReturnType<typeof betterAuth>;

let cached: Auth | null = null;

// Mail is sent best-effort: a provider failure is logged, never surfaced, so the
// endpoints answer the same whether or not the account exists (same rule the
// reset email always followed).
async function deliver(to: string, mail: EmailContent, what: string): Promise<void> {
  await sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html }).catch((error) =>
    console.error(`[auth] ${what} email failed`, error),
  );
}

function passwordChangedNotice(email: string): Promise<void> {
  return deliver(
    email,
    passwordChangedEmail({
      when: new Date(),
      resetUrl: absoluteAuthUrl("/forgot-password", process.env),
    }),
    "password-changed",
  );
}

// AUTH-001. Lazily constructed for the same reason lib/db's `db` export is
// a Proxy rather than an eager client: this module is imported transitively
// by middleware.ts (via lib/auth-guard.ts), and Phase 1's own build must
// keep succeeding with zero env vars (spec §2). Constructing Better Auth
// eagerly at module load would read BETTER_AUTH_SECRET/GOOGLE_CLIENT_ID at
// import time instead of call time — this instead follows the same
// call-time-env-read idiom lib/admin-guard.ts already uses for
// KEYSTATIC_GITHUB_CLIENT_ID.
function getAuth(): Auth {
  if (cached) return cached;

  const emailEnabled = isEmailConfigured();

  cached = betterAuth({
    // drizzleAdapter only touches `db` (itself a lazy Proxy — see
    // lib/db/index.ts) when Better Auth is actually asked to do something,
    // i.e. when a request reaches app/api/auth/[...all]/route.ts or a
    // Server Component/Action calls auth.api.getSession. Constructing the
    // adapter here doesn't itself open a connection.
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    // T13: on a Vercel Preview deployment this is the preview's own host, so
    // emailed links stay on the preview; everywhere else it is BETTER_AUTH_URL
    // exactly as before (lib/auth-base-url.ts).
    baseURL: resolveAuthBaseUrl(process.env),
    // Decision #1 (user-confirmed): Google OAuth + email/password fallback,
    // no other providers.
    emailAndPassword: {
      enabled: true,
      // D1 = Option B: signing in does NOT require a verified address. What
      // verification gates is anything privileged (lib/admin-guard.ts
      // isVerifiedAdmin). requireEmailVerification stays unset on purpose.
      //
      // Password reset exists only when an email provider is configured
      // (lib/email.ts). Without sendResetPassword Better Auth refuses the
      // request itself, and the UI hides the link (isEmailConfigured()).
      ...(emailEnabled
        ? {
            resetPasswordTokenExpiresIn: 60 * 60,
            // T4: a reset must end every session that was open under the old
            // password, otherwise whoever had the account keeps it.
            revokeSessionsOnPasswordReset: true,
            sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
              await deliver(user.email, resetPasswordEmail(url), "reset");
            },
            // T5: tell the owner the password changed. No password, no token.
            onPasswordReset: async ({ user }: { user: { email: string } }) => {
              await passwordChangedNotice(user.email);
            },
          }
        : {}),
    },
    // T1: verification mail. Only when email is configured; without it signup
    // works exactly as before and nothing asks for verification.
    ...(emailEnabled
      ? {
          emailVerification: {
            // Explicit: with requireEmailVerification unset the library would
            // otherwise send nothing at signup.
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            expiresIn: 60 * 60 * 24,
            sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
              await deliver(user.email, verificationEmail(url), "verification");
            },
          },
        }
      : {}),
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              // Standard minimal scope (AUTH-001 requirement) — decision #2
              // (only email + name collected/displayed) doesn't need
              // anything beyond this.
              scope: ["openid", "email", "profile"],
            },
          }
        : undefined,
    account: {
      // T3. "email-password" used to be listed as a trusted provider. Signup
      // does not verify the address, so trusting it was the setup for a
      // pre-registration takeover; in 1.4.22 the entry has no effect on the
      // OAuth paths anyway. "google" is no longer trusted either: Google now
      // links to an existing account only when Google itself reports the email
      // as verified (the library's default rule), which is always the case for
      // ordinary Google accounts. The remaining gap (unverified password
      // account + later Google sign-in) is closed in databaseHooks below.
      accountLinking: {
        enabled: true,
      },
    },
    databaseHooks: {
      account: {
        create: {
          after: async (created) => {
            // Runs before Better Auth marks the address verified.
            await handleAccountCreated(created, dbLinkingStore).catch((error) =>
              console.error("[auth] linking guard failed", error),
            );
          },
        },
      },
    },
    // T11: self-serve deletion, only with email (the confirmation is a link
    // sent to the account address). Better Auth deletes the user row; the
    // planner, quiz, study-session and companion rows go with it by cascade.
    ...(emailEnabled
      ? {
          user: {
            deleteUser: {
              enabled: true,
              deleteTokenExpiresIn: 60 * 60,
              sendDeleteAccountVerification: async ({ user, url }: { user: { email: string }; url: string }) => {
                await deliver(user.email, deleteAccountEmail(url), "delete-account");
              },
              afterDelete: async (deleted: { id: string }) => {
                await removeVerificationRowsForUser(deleted.id).catch((error) =>
                  console.error("[auth] post-delete cleanup failed", error),
                );
              },
            },
          },
        }
      : {}),
    // T7: database-backed limits that hold across serverless instances.
    rateLimit: authRateLimitOptions(),
    // T5: change-password has no callback option, so notify from an after hook.
    // The endpoint's own JSON answer carries the user; failures are skipped.
    ...(emailEnabled
      ? {
          hooks: {
            after: createAuthMiddleware(async (ctx) => {
              const email = emailForPasswordChange({ path: ctx.path, returned: ctx.context.returned });
              if (email) await passwordChangedNotice(email);
            }),
          },
        }
      : {}),
  });

  return cached;
}

type AuthHandler = (request: Request) => Promise<Response>;

// Better Auth's Next.js adapter accepts either:
// 1) an object with a `handler` function, or
// 2) a function itself.
// The library's runtime check uses `"handler" in auth`, so the exported value
// must explicitly expose `handler` on the object itself. The rest of the
// instance remains lazily proxied so env reads happen only on first real use.
const authHandler: AuthHandler = (request) => getAuth().handler(request);

export const auth: Auth & { handler: AuthHandler } = new Proxy(
  { handler: authHandler } as Auth & { handler: AuthHandler },
  {
    get(target, prop, receiver) {
      if (prop === "handler") {
        return Reflect.get(target, prop, receiver);
      }
      return Reflect.get(getAuth(), prop, receiver);
    },
    has(target, prop) {
      if (prop === "handler") return true;
      return Reflect.has(getAuth(), prop) || Reflect.has(target, prop);
    },
  },
);
