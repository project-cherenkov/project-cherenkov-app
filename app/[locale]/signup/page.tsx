import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "@/components/auth/signup-form";
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
    <Suspense>
      <SignupForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}

