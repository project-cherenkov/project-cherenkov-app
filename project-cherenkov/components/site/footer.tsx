import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-slate-200/80">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500 sm:px-6">
        <p className="label-code mb-2">footer.md</p>
        <p>{t("tagline")}</p>
        <p className="mt-1">{t("madeBy")}</p>
      </div>
    </footer>
  );
}
