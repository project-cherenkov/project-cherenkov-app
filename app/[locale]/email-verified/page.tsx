import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { classifyVerificationLinkError } from "@/lib/auth-error-messages";
import { isEmailConfigured } from "@/lib/email";
import { pageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "phase2.emailVerified" });
  return pageMetadata({ locale, path: "/email-verified", title: t("title"), description: t("title"), noindex: true });
}

// Where the emailed verification link ends up. Better Auth has already checked
// the token by the time the browser gets here: success arrives with no query,
// a rejected token arrives as ?error=... (lib/auth-error-messages.ts).
//
// Without an email provider no verification email can exist, so the page does
// not either (same rule as the reset-password pages).
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (!isEmailConfigured()) notFound();
  const { error } = await searchParams;
  const problem = classifyVerificationLinkError(Array.isArray(error) ? error[0] : error);
  const t = await getTranslations("phase2.emailVerified");

  if (!problem) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
        <h1 className="mb-3 text-2xl font-semibold text-foreground">{t("successHeading")}</h1>
        <p role="status" className="text-sm text-foreground/75">
          {t("successBody")}
        </p>
        <Link href="/account" className={buttonVariants({ className: "mt-6" })}>
          {t("toAccount")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
      <h1 className="mb-3 text-2xl font-semibold text-foreground">
        {t(problem === "expired" ? "expiredHeading" : "invalidHeading")}
      </h1>
      <p role="alert" className="text-sm text-danger">
        {t(problem === "expired" ? "expiredBody" : "invalidBody")}
      </p>
      <Link href="/login" className={buttonVariants({ className: "mt-6" })}>
        {t("toLogin")}
      </Link>
    </div>
  );
}
