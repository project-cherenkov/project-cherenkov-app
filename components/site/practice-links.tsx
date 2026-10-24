import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";

import { isPracticeLinkStale, type PracticeLink } from "@/lib/practice-links";

// External practice problems for an editorial (R7). Links only; the problem
// statements stay on the other site. Every link shows when it was last
// checked, and one older than PRACTICE_LINK_STALE_DAYS is flagged so a moved
// or dead link is visible instead of silently rotting.
export async function PracticeLinks({ links }: { links: PracticeLink[] }) {
  if (links.length === 0) return null;
  const [t, locale] = await Promise.all([getTranslations("editorial"), getLocale()]);
  const now = new Date();
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

  return (
    <section aria-labelledby="practice-heading" className="mt-10 border-t border-border pt-6">
      <h2 id="practice-heading" className="label-code mb-1">
        {t("practice.heading")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("practice.note")}</p>
      <ul className="space-y-2">
        {links.map((link) => {
          const stale = isPracticeLinkStale(link.checkedOn, now);
          return (
            <li key={link.url} className="text-sm">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-cherenkov-blue-800 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
              >
                {link.title}
                <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                <span className="sr-only">{t("practice.opensNewTab")}</span>
              </a>
              <span className="ml-2 text-xs text-muted-foreground">
                {t("practice.checkedOn", { date: formatDate(link.checkedOn) })}
              </span>
              {stale ? (
                <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {t("practice.stale")}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
