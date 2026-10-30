"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { classifyAuthError } from "@/lib/auth-error-messages";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";

export function PasswordSettings({
  email,
  hasPassword,
  resetEnabled,
}: {
  email: string;
  hasPassword: boolean;
  resetEnabled: boolean;
}) {
  const t = useTranslations("account.password");
  const tErrors = useTranslations("phase2.authErrors");
  const locale = useLocale();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!resetEnabled) return null;

  function requestPasswordSetup() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `/${locale}/reset-password`,
        });
        if (result.error) {
          setError(t("genericError"));
          return;
        }
        setSent(true);
      } catch (err) {
        setError(
          classifyAuthError(err) === "network"
            ? tErrors("network")
            : t("genericError"),
        );
      }
    });
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.changePassword({
          currentPassword,
          newPassword,
        });
        if (result.error) {
          setError(result.error.message ?? t("genericError"));
          return;
        }
        setCurrentPassword("");
        setNewPassword("");
        setSent(true);
      } catch (err) {
        setError(
          classifyAuthError(err) === "network"
            ? tErrors("network")
            : t("genericError"),
        );
      }
    });
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">
        {hasPassword ? t("changeTitle") : t("setTitle")}
      </h2>
      <p className="mt-1 text-sm text-foreground/75">
        {hasPassword ? t("changeBody") : t("setBody", { email })}
      </p>
      {sent ? (
        <p role="status" className="mt-4 text-sm text-foreground/75">
          {hasPassword ? t("changed") : t("sent")}
        </p>
      ) : hasPassword ? (
        <form onSubmit={changePassword} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            {t("currentPassword")}
            <PasswordInput
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("newPassword")}
            <PasswordInput
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending ? t("saving") : t("changeButton")}
          </Button>
        </form>
      ) : (
        <>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            className="mt-4"
            onClick={requestPasswordSetup}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? t("sending") : t("setButton")}
          </Button>
        </>
      )}
    </section>
  );
}
