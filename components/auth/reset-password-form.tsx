"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link } from "@/i18n/routing";
import { authClient } from "@/lib/auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";
import { authCodeKey, classifyAuthError } from "@/lib/auth-error-messages";

// Step 2: the emailed link lands here as ?token=... (or ?error=INVALID_TOKEN
// when Better Auth rejected it before redirecting).
export function ResetPasswordForm() {
  const t = useTranslations("phase2.reset");
  const tCodes = useTranslations("phase2.authCodes");
  const tErrors = useTranslations("phase2.authErrors");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkRejected = searchParams.get("error") !== null;
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!token || linkRejected) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
        <h1 className="mb-3 text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t("invalidToken")}
        </p>
        <Link href="/forgot-password" className={buttonVariants({ className: "mt-6" })}>
          {t("requestAgain")}
        </Link>
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.resetPassword({ newPassword: password, token: token! });
        if (result.error) {
          const key = authCodeKey(result.error.code);
          setError(key ? tCodes(key) : t("genericError"));
          return;
        }
        setDone(true);
      } catch (err) {
        setError(classifyAuthError(err) === "network" ? tErrors("network") : t("genericError"));
      }
    });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">{t("title")}</h1>
      {done ? (
        <>
          <p role="status" className="text-sm text-foreground/75">
            {t("done")}
          </p>
          <Link href="/login" className={buttonVariants({ className: "mt-6" })}>
            {t("goToLogin")}
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            {t("passwordLabel")}
            <PasswordInput
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending ? t("submitting") : t("submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
