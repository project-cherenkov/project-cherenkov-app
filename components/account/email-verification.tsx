"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { authCodeKey, classifyAuthError } from "@/lib/auth-error-messages";
import { Button } from "@/components/ui/button";

// Shown under the email on the Account page, only when the deployment can send
// email (the page decides; this component is never rendered otherwise).
// Verification matters because editor access needs a verified address
// (lib/admin-guard.ts isVerifiedAdmin).
export function EmailVerification({ email, verified }: { email: string; verified: boolean }) {
  const t = useTranslations("account.verification");
  const tCodes = useTranslations("auth.codes");
  const tErrors = useTranslations("auth.errors");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.sendVerificationEmail({
          email,
          callbackURL: `/${locale}/email-verified`,
        });
        if (result.error) {
          const key = authCodeKey(result.error.code);
          setError(
            key
              ? tCodes(key)
              : classifyAuthError(result.error) === "rateLimited"
                ? tErrors("rateLimited")
                : t("genericError"),
          );
          return;
        }
        setSent(true);
      } catch (err) {
        setError(classifyAuthError(err) === "network" ? tErrors("network") : t("genericError"));
      }
    });
  }

  return (
    <span className="mt-1 block text-sm">
      <span className={verified ? "font-medium text-foreground" : "font-medium text-warning"}>
        {verified ? t("verified") : t("unverified")}
      </span>
      {!verified ? (
        sent ? (
          <span role="status" className="mt-2 block text-foreground/75">
            {t("sent")}
          </span>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="mt-2 block"
              onClick={send}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? t("sending") : t("send")}
            </Button>
            {error ? (
              <span role="alert" className="mt-2 block text-danger">
                {error}
              </span>
            ) : null}
          </>
        )
      ) : null}
    </span>
  );
}
