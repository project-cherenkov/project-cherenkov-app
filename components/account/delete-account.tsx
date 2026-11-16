"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { authCodeKey, classifyAuthError } from "@/lib/auth-error-messages";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";

// T11. Self-serve deletion in two steps. Step 1 (here) asks for a confirmation
// email; for an account with a password it also asks for that password, so a
// borrowed signed-in browser cannot start it alone. Step 2 is the emailed link,
// which only works while signed in as the same account (Better Auth checks
// both). Rendered by the Account page only when email is configured.
export function DeleteAccount({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const t = useTranslations("account.delete");
  const tCodes = useTranslations("auth.codes");
  const tErrors = useTranslations("auth.errors");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.deleteUser({
          ...(hasPassword ? { password } : {}),
          callbackURL: `/${locale}/account-deleted`,
        });
        if (result.error) {
          const key = authCodeKey(result.error.code);
          setError(
            key
              ? tCodes(key)
              : classifyAuthError(result.error) === "rateLimited"
                ? tErrors("rateLimited")
                : (result.error.message ?? t("genericError")),
          );
          return;
        }
        setPassword("");
        setSent(true);
      } catch (err) {
        setError(classifyAuthError(err) === "network" ? tErrors("network") : t("genericError"));
      }
    });
  }

  return (
    <section className="mt-8 rounded-lg border border-danger-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
      <p className="mt-1 text-sm text-foreground/75">{t("body")}</p>
      {sent ? (
        <p role="status" className="mt-4 text-sm text-foreground/75">
          {t("sent", { email })}
        </p>
      ) : !open ? (
        <Button type="button" variant="outline" className="mt-4" onClick={() => setOpen(true)}>
          {t("start")}
        </Button>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-foreground/75">{t("confirmBody", { email })}</p>
          {hasPassword ? (
            <label className="flex flex-col gap-1 text-sm">
              {t("passwordLabel")}
              <PasswordInput
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isPending} aria-busy={isPending}>
              {isPending ? t("sending") : t("confirmButton")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(null);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
