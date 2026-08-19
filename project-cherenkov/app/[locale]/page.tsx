import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { EditorialCard } from "@/components/site/editorial-card";
import { getRecentEditorials } from "@/lib/content";

export default async function HomePage() {
  const t = await getTranslations("home");
  const recent = getRecentEditorials();

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        {t("heroTitle")}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">{t("heroBody")}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/archive" className={buttonVariants({ size: "lg" })}>
          {t("ctaArchive")}
        </Link>
        <Link
          href="/about"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          {t("ctaAbout")}
        </Link>
      </div>

      <section className="mt-16">
        <h2 className="label-code mb-4">{t("recentHeading")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">{t("recentEmpty")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((editorial) => (
              <EditorialCard
                key={`${editorial.subject}-${editorial.slug}`}
                editorial={editorial}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
