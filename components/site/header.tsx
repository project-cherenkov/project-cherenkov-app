import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-cherenkov-offwhite/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-cherenkov-blue-pastel"
          />
          <span className="font-mono text-sm font-semibold tracking-tight text-slate-900">
            cherenkov
          </span>
        </Link>

        <nav className="flex items-center gap-1 font-mono text-xs uppercase tracking-wide">
          <Link
            href="/archive"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
          >
            {t("archive")}
          </Link>
          <Link
            href="/about"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
          >
            {t("about")}
          </Link>
          <a
            href="https://github.com/PLACEHOLDER-org/PLACEHOLDER-repo"
            target="_blank"
            rel="noreferrer"
            className="ml-1 rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
          >
            {t("repo")}
          </a>
        </nav>
      </div>
    </header>
  );
}
