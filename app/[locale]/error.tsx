"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{t("heading")}</h1>
      <p className="mt-3 text-slate-700">{t("body")}</p>
      <Button className="mt-6" onClick={() => reset()}>
        {t("retry")}
      </Button>
    </div>
  );
}
