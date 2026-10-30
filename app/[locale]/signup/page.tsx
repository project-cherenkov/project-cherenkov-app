import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { pageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "phase2.signup" });
  return pageMetadata({ locale, path: "/signup", title: t("title"), description: t("title"), noindex: true });
}

export default function SignupPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  return (
    <Suspense><AuthPage defaultTab="signup" googleEnabled={googleEnabled} /></Suspense>
  );
}
