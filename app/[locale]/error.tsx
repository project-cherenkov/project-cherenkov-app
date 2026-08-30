"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/site/error-state";

// TICKET-01 / ARCH-002: baseline catch-all error boundary. Next.js's App
// Router requires error.tsx to be a Client Component; it replaces this
// segment's subtree on an uncaught render error, so this intentionally does
// NOT try to keep <SiteHeader>/<SiteFooter> — a minimal, on-brand full-page
// state is simpler and safer than assuming the rest of the tree that just
// threw can still be trusted to render alongside it.
//
// This is a baseline, [locale]-wide boundary. It doesn't fix ARCH-001 by
// itself — it contains the blast radius of *any* uncaught render error
// (ARCH-001 included) to a scoped fallback instead of Next's generic
// unstyled "Application error" screen.
export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <ErrorState
        eyebrow="error.log"
        heading={t("heading")}
        body={t("body")}
        ctaLabel={t("retry")}
        onRetry={reset}
      />
    </div>
  );
}
