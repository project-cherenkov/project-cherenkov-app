import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";

const gitHubBase = "https://github.com/project-cherenkov/project-cherenkov-app/blob/main";

const linkClass = "inline-flex min-h-8 items-center underline hover:text-foreground";

export function SiteFooter() {
  const t = useTranslations("footer");

  // The three legal links open GitHub in a new tab. Saying so (visually
  // hidden, but read by screen readers) is WCAG 3.2.5 / technique G201 — a
  // new window is a context change people should be warned about.
  const external = (
    <span className="sr-only"> {t("opensInNewTab")}</span>
  );

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        <p className="label-code mb-2">footer.md</p>
        <p>{t("tagline")}</p>
        <p className="mt-1">{t("madeBy")}</p>

        <nav
          aria-label={t("navLabel")}
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-wide"
        >
          <Link href="/docs" className={linkClass}>
            {t("docs")}
          </Link>
          <a href={`${gitHubBase}/LICENSE`} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("license")}
            {external}
          </a>
          <a href={`${gitHubBase}/TERMS.md`} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("terms")}
            {external}
          </a>
          <a href={`${gitHubBase}/PRIVACY.md`} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("privacy")}
            {external}
          </a>
          <a href="mailto:projectcherenkov@gmail.com" className={linkClass}>
            {t("contact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
