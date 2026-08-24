import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { siteUrl } from "@/lib/site";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("name"), template: `%s — ${t("name")}` },
    description: t("tagline"),
    openGraph: {
      title: t("name"),
      description: t("tagline"),
      locale,
      alternateLocale: routing.locales.filter((l) => l !== locale),
      type: "website",
    },
    // DEPLOYMENT-READINESS DEFAULT, not part of the original spec: every
    // page is noindex/nofollow for now. messages/*.json still has several
    // "[PLACEHOLDER — ...]" strings (heroTitle, tagline, philosophy, team
    // bios) — t("tagline") above literally becomes the page's <meta
    // name="description">, so search engines would index that placeholder
    // text verbatim today. Flip this once real hero/tagline/about copy
    // (README's "Open questions" list) is in — search the codebase for
    // this comment when that happens, nothing else needs to change.
    robots: { index: false, follow: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Enables static rendering for this locale (next-intl requirement).
  setRequestLocale(locale);
  const messages = await getMessages();

  // <html>/<body> now live in app/layout.tsx (the actual App Router root
  // layout) — see the comment there for why. This layout no longer renders
  // them itself; `lang={locale}` moves there too since it can't be set
  // dynamically per-locale from the real root, but every route under this
  // segment sets it via next-intl's own <html lang> handling in
  // NextIntlClientProvider is not applicable here — see note below.
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </NextIntlClientProvider>
  );
}
