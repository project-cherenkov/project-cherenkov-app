import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/theme-provider";
import { SkipLink } from "@/components/site/skip-link";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { fontVariableClasses } from "@/lib/fonts";
import { OG_LOCALES, isAppLocale, robotsFor } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Matches --background in app/globals.css so the mobile browser chrome blends
// into the page in both themes. Zoom is deliberately NOT restricted
// (no maximumScale / userScalable) — WCAG 1.4.4 / 1.4.10.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF5F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0B2436" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  const ogLocale = isAppLocale(locale) ? OG_LOCALES[locale] : OG_LOCALES.id;
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("homeTitle"), template: `%s — ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    openGraph: {
      title: t("homeTitle"),
      description: t("tagline"),
      siteName: t("name"),
      locale: ogLocale,
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALES[l]),
      type: "website",
    },
    twitter: { card: "summary_large_image" },
    // Site-wide default. Every page that builds its own metadata through
    // lib/seo.ts inherits the same switch; account/auth/planner pages force
    // noindex on top of it. The switch itself is NEXT_PUBLIC_ALLOW_INDEXING
    // (see lib/seo.ts) — it replaces the old hard-coded
    // `robots: { index: false, follow: false }` so going live no longer
    // needs a code change.
    robots: robotsFor(),
  };
}

// This is now the ROOT layout for every localized route (the previous
// app/layout.tsx was removed). Having <html> here is what lets `lang` follow
// the URL's locale — with one shared root layout it could only ever be a
// fixed "en", which made every Indonesian page (the default locale!) announce
// itself to screen readers and search engines as English (WCAG 3.1.1).
// /keystatic has its own root layout in app/keystatic/layout.tsx.
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

  return (
    <html lang={locale} suppressHydrationWarning className={fontVariableClasses}>
      <body className="font-sans bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <SkipLink />
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              {/* tabIndex={-1} lets the skip link move focus here; the ring is
                  suppressed because the whole region lighting up is noise. */}
              <main
                id="main-content"
                tabIndex={-1}
                className="flex-1 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                {children}
              </main>
              <SiteFooter />
            </div>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
