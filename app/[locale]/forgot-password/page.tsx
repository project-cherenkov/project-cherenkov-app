import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { isEmailConfigured } from "@/lib/email";
import { pageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "phase2.forgot" });
  return pageMetadata({ locale, path: "/forgot-password", title: t("title"), description: t("title"), noindex: true });
}

// Password reset needs an email provider (lib/email.ts). Without one the page
// does not exist, so the route cannot be used to probe accounts.
export const dynamic = "force-dynamic";

export default function Page() {
  if (!isEmailConfigured()) notFound();
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
