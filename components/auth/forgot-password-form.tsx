"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { classifyAuthError } from "@/lib/auth-error-messages";

// Step 1 of password reset: ask for the email. The answer is deliberately the
// same whether or not an account exists, so the form cannot be used to find out
// who is registered.
export function ForgotPasswordForm() {
  const t = useTranslations("phase2.forgot");
  const tErrors = useTranslations("phase2.authErrors");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `/${locale}/reset-password`,
        });
        if (result.error) {
          const reason = classifyAuthError(result.error);
          setError(reason === "network" ? tErrors(reason) : t("genericError"));
          return;
        }
        setSent(true);
      } catch (err) {
        setError(classifyAuthError(err) === "network" ? tErrors("network") : t("genericError"));
      }
    });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
      <h1 className="mb-3 text-2xl font-semibold text-foreground">{t("title")}</h1>
      {sent ? (
        <p role="status" className="text-sm text-foreground/75">
          {t("sent")}
        </p>
      ) : (
        <>
          <p className="mb-6 text-sm text-foreground/75">{t("intro")}</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              {t("emailLabel")}
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
        </>
      )}
      <p className="mt-6 text-sm">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
