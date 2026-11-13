import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { formatCommitDate } from "@/lib/last-updated";

const gitHubBase = "https://github.com/project-cherenkov/project-cherenkov-app/blob/main";
const lastUpdatedAt = process.env.NEXT_PUBLIC_LAST_UPDATED_AT;

const linkClass = "inline-flex min-h-8 items-center underline hover:text-foreground";

export function SiteFooter() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  if (!lastUpdatedAt) {
    throw new Error("NEXT_PUBLIC_LAST_UPDATED_AT is not configured.");
  }

  // The three legal links open GitHub in a new tab. Saying so (visually
  // hidden, but read by screen readers) is WCAG 3.2.5 / technique G201 — a
  // new window is a context change people should be warned about.
  const external = (
    <span className="sr-only"> {t("opensInNewTab")}</span>
  );

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p className="label-code mb-2">footer.md</p>
        <p lang="en">{t("tagline")}</p>
        <p lang="la" className="mt-0.5 text-xs">
          {t("motto")}
        </p>
        <p className="mt-1">{t("madeBy")}</p>
        <p className="mt-1">
          {t("lastUpdatedOn")}: {formatCommitDate(lastUpdatedAt, locale)}
        </p>

        <nav
          aria-label={t("navLabel")}
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-wide"
        >
          {/* The main sections, so every one of them is a single hop from any
              page for crawlers and for people who scrolled to the bottom. */}
          <Link href="/syllabus" className={linkClass}>
            {tNav("syllabus")}
          </Link>
          <Link href="/materials" className={linkClass}>
            {tNav("materials")}
          </Link>
          <Link href="/archive" className={linkClass}>
            {tNav("editorials")}
          </Link>
          <Link href="/about" className={linkClass}>
            {tNav("about")}
          </Link>
          <Link href="/docs" className={linkClass}>
            {t("docs")}
          </Link>
          <Link href="/updates" className={linkClass}>
            {t("updates")}
          </Link>
          <a href={`${gitHubBase}/LICENSE`} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("license")}
            {external}
          </a>
          <Link href="/terms" className={linkClass}>
            {t("terms")}
          </Link>
          <Link href="/privacy" className={linkClass}>
            {t("privacy")}
          </Link>
          <a href="mailto:projectcherenkov@gmail.com" className={linkClass}>
            {t("contact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
