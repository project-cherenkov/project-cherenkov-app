"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { classifyAuthError, classifyCallbackError } from "@/lib/auth-error-messages";

export interface LoginFormProps {
  // Server-computed (GOOGLE_CLIENT_ID isn't a NEXT_PUBLIC_* var, so this
  // Client Component can't read it itself) — same graceful-degradation
  // pattern already used for Keystatic's GitHub OAuth (spec §5).
  googleEnabled: boolean;
}

// AUTH-002. Failure handling (spec §6): Better Auth's own per-field error
// is surfaced inline, verbatim, when the server actually returns one.
// AUTH-003 adds the two failure modes that previously showed nothing at
// all: a thrown (not returned) exception from either sign-in call, and a
// failed Google OAuth round trip — see lib/auth-error-messages.ts for why
// each is classified into a specific, translated message rather than one
// generic fallback.
export function LoginForm({ googleEnabled }: LoginFormProps) {
  const t = useTranslations("phase2.login");
  const tErrors = useTranslations("phase2.authErrors");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, setIsGooglePending] = useState(false);

  // Covers the OAuth round-trip failure mode: the browser left for Google
  // and came back with `?error=...` on the URL — either the user declined
  // consent, or Better Auth's callback handler rejected the result (e.g.
  // this Google account's email is already registered via email/password).
  // Only meant to catch an error already present when the page loads, not
  // to react to every later search-param change.
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return;
    setError(tErrors(classifyCallbackError(errorParam)));
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message ?? t("genericError"));
          return;
        }
        router.push(
          nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
            ? nextPath
            : "/planner",
        );
      } catch (err) {
        // The request never got a structured response to read a per-field
        // error out of at all — e.g. offline, or the deployment's own API
        // route unreachable. Better Auth's own message above still takes
        // priority; this only fires when there wasn't one to show.
        setError(tErrors(classifyAuthError(err)));
      }
    });
  }

  async function handleGoogle() {
    setError(null);
    setIsGooglePending(true);
    try {
      const result = await signIn.social({
        provider: "google",
        callbackURL:
          nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
            ? nextPath
            : `/${locale}/planner`,
      });
      // A successful call redirects the browser to Google before this
      // promise ever resolves — reaching here with an error means our own
      // server rejected the request before any redirect happened at all
      // (the failure mode the bare `void signIn.social(...)` used to
      // swallow completely).
      if (result?.error) {
        setError(tErrors(classifyAuthError(result.error)));
        setIsGooglePending(false);
      }
    } catch (err) {
      setError(tErrors(classifyAuthError(err)));
      setIsGooglePending(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">
        {t("title")}
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("emailLabel")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("passwordLabel")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {t("submit")}
        </Button>
      </form>

      {googleEnabled ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-center text-xs uppercase tracking-wide text-slate-400">
            {t("orDivider")}
          </p>
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogle}
            disabled={isGooglePending}
          >
            {t("googleButton")}
          </Button>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-slate-600">
        {t("noAccount")}{" "}
        <Link href="/signup" className="underline">
          {t("signupLink")}
        </Link>
      </p>
    </div>
  );
}
