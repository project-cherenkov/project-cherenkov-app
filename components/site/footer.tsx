import { useTranslations } from "next-intl";

const gitHubBase = "https://github.com/project-cherenkov/project-cherenkov-app/blob/main";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
        <p className="label-code mb-2">footer.md</p>
        <p>{t("tagline")}</p>
        <p className="mt-1">{t("madeBy")}</p>

        <nav className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase tracking-wide">
          <a href={`${gitHubBase}/LICENSE`} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            {t("license")}
          </a>
          <a href={`${gitHubBase}/TERMS.md`} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            {t("terms")}
          </a>
          <a href={`${gitHubBase}/PRIVACY.md`} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            {t("privacy")}
          </a>
          <a href="mailto:projectcherenkov@gmail.com" className="underline hover:text-foreground">
            {t("contact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
