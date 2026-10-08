import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { pageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "phase2.login" });
  return pageMetadata({ locale, path: "/login", title: t("title"), description: t("title"), noindex: true });
}

// AUTH-002. Google button visibility is decided server-side (GOOGLE_CLIENT_ID
// isn't a NEXT_PUBLIC_* var) and passed down as a plain boolean — same
// graceful-degradation pattern already used for Keystatic's GitHub OAuth.
export default function LoginPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}

