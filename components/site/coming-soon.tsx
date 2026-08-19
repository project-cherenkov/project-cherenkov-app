import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";

// Phase 2 (accounts + study planner) is architected but not built — see
// docs/phase-2-architecture.md. These routes exist now so the eventual
// Phase 2 build has a stable place to land, and so nothing 404s if a
// contributor links to /login or /planner early.
export function ComingSoon({ title }: { title: string }) {
  const t = useTranslations("phase2");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="label-code rounded-full bg-cherenkov-pink/40 px-3 py-1">
        {t("comingSoon")}
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 text-slate-600">{t("comingSoonBody")}</p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        {t("backHome")}
      </Link>
    </div>
  );
}
