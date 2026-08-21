import type { ReactNode } from "react";
import "./globals.css";

// NECESSARY FIX, not part of the original spec: Next.js App Router requires
// every route to resolve to a root layout that renders <html>/<body>.
// Previously only app/[locale]/layout.tsx provided one, which worked while
// every route lived under [locale]. Workstream D adds /keystatic and
// /api/keystatic OUTSIDE that segment (deliberately — CMS-004 requires
// /keystatic to load with no locale prefix), so `next build` now fails
// with "doesn't have a root layout" without this file.
//
// This is a small, low-risk, directly-necessary change per the worker
// prompt's "unrelated issue that blocks the feature" rule — not a
// redesign. app/[locale]/layout.tsx no longer renders <html>/<body> itself
// (see that file); this is now the only place that does, for the whole
// app, locale routes included.
export default function RootLayout({ children }: { children: ReactNode }) {
  // lang is a static "en" here rather than dynamic per-locale: only the
  // App Router's true root layout may render <html>, and this component
  // has no access to the [locale] route param (it sits above that
  // segment, and is also the layout for non-locale routes like
  // /keystatic). Locale content pages set the correct lang via
  // NextIntlClientProvider inside app/[locale]/layout.tsx; only the raw
  // <html lang="..."> attribute itself falls back to "en" for non-locale
  // routes. Minor, documented tradeoff — not present before this change,
  // since there was previously no route outside [locale] to expose it.
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
