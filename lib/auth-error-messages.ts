// AUTH-003. Shared error classification for both login-form.tsx and
// signup-form.tsx. Better Auth's own error objects/messages are inconsistent
// in shape depending on *where* the failure happens, so this file collapses
// every failure mode into one small, stable set of codes. Each code maps
// 1:1 to a translated string in messages/{id,en}.json under
// "phase2.authErrors" — components just do
// `tErrors(classifyAuthError(err))`.
//
// Two entry points, because a social (OAuth) sign-in can fail in two
// completely different places:
//   1. classifyAuthError    — the initial request to OUR OWN server fails
//      (before the browser ever leaves the page to go to Google). Covers
//      both a thrown exception (the fetch itself never got a response —
//      offline, DNS failure, the deployment's API route unreachable) and a
//      structured `{ error }` result Better Auth's client returns when our
//      server responds but rejects the request.
//   2. classifyCallbackError — the browser DID leave for Google and came
//      back, but the OAuth flow still failed: the user declined consent,
//      or Better Auth's callback handler rejected the result (e.g. the
//      Google account's email already belongs to a different sign-in
//      method). These arrive as a query parameter on the URL Better Auth
//      redirects back to, not as a value this module can read directly.
//
// UNVERIFIED: this environment has no network access to confirm Better
// Auth's exact `error.status`/`error.code` values, or its callback
// query-parameter name, against the actually-installed version (same class
// of gap already flagged in lib/auth.ts and app/api/auth/[...all]/route.ts).
// Both functions are written defensively — pattern-matching on the
// documented/common shapes — so an unrecognized error still resolves to
// "unknown" (a specific, translated "something went wrong" message) rather
// than throwing or silently showing nothing. Verify the concrete shapes
// against the installed better-auth version before relying on this for
// anything beyond "the user always sees *some* accurate-enough message."

export type AuthErrorCode =
  | "network"
  | "notConfigured"
  | "misconfigured"
  | "denied"
  | "accountExists"
  | "rateLimited"
  | "server"
  | "unknown";

interface BetterAuthErrorLike {
  status?: number;
  statusText?: string;
  message?: string;
  code?: string;
}

function isBetterAuthErrorLike(value: unknown): value is BetterAuthErrorLike {
  return typeof value === "object" && value !== null;
}

/**
 * Classifies a failure from the initial sign-in/sign-up call: either a
 * thrown exception (caught in a try/catch around the call) or the
 * `result.error` object Better Auth's client resolves with.
 */
export function classifyAuthError(error: unknown): AuthErrorCode {
  // Browsers throw specifically a TypeError when fetch() itself fails
  // before any response comes back — offline, DNS failure, a CORS
  // rejection, the deployment's own API route unreachable. This is the one
  // thrown-exception shape reliable enough to classify without guessing;
  // any other thrown Error falls through to the structured-error checks
  // below (harmless — it just won't match any of them) and lands on
  // "unknown" rather than being mislabeled as a network problem it might
  // not be.
  if (error instanceof TypeError) {
    return "network";
  }

  if (!isBetterAuthErrorLike(error)) {
    return "unknown";
  }

  const status = error.status;
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (status === 429 || code.includes("rate_limit")) {
    return "rateLimited";
  }

  if (
    code.includes("account_not_linked") ||
    code.includes("email_exists") ||
    message.includes("already exists") ||
    message.includes("already registered") ||
    message.includes("already associated")
  ) {
    return "accountExists";
  }

  if (
    message.includes("provider") &&
    (message.includes("not found") ||
      message.includes("not enabled") ||
      message.includes("disabled") ||
      message.includes("not configured"))
  ) {
    return "notConfigured";
  }

  if (status === 401 || status === 403) {
    return "denied";
  }

  if (typeof status === "number" && status >= 500) {
    return "misconfigured";
  }

  if (typeof status === "number" && status >= 400) {
    return "server";
  }

  return "unknown";
}

/**
 * Classifies the `error` query parameter present on the URL when the
 * browser bounces back from a failed OAuth attempt (the user declined on
 * Google's consent screen, or Better Auth's own callback handler rejected
 * the result after Google's side succeeded).
 */
export function classifyCallbackError(errorParam: string): AuthErrorCode {
  const value = errorParam.toLowerCase();

  // Standard OAuth 2.0 value (RFC 6749 §4.1.2.1) — Google sets this
  // itself when the user declines consent, so this one is safe to rely on
  // regardless of the Better Auth version.
  if (value === "access_denied" || value.includes("access_denied")) {
    return "denied";
  }

  if (value.includes("account_not_linked") || value.includes("email_exists")) {
    return "accountExists";
  }

  if (value.includes("not_configured") || value.includes("configuration")) {
    return "notConfigured";
  }

  if (value.includes("rate_limit")) {
    return "rateLimited";
  }

  return "unknown";
}
