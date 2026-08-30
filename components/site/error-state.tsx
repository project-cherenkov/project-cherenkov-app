import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  eyebrow?: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref?: string;
  onRetry?: () => void;
  illustration?: ReactNode;
}

export function ErrorState({
  eyebrow,
  heading,
  body,
  ctaLabel,
  ctaHref,
  onRetry,
  illustration,
}: ErrorStateProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      {eyebrow && <p className="label-code mb-2">{eyebrow}</p>}
      {illustration && <div className="mb-4">{illustration}</div>}
      <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
        {heading}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {body}
      </p>
      {ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cherenkov-blue px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-cherenkov-blue-pastel focus-visible:outline-none"
        >
          {ctaLabel}
        </Link>
      ) : onRetry ? (
        <Button className="mt-6" onClick={onRetry}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
