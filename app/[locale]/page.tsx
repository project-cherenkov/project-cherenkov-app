import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { EditorialCard } from "@/components/site/editorial-card";
import { JsonLd } from "@/components/seo/json-ld";
import { getRecentEditorials } from "@/lib/content";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return pageMetadata({
    locale,
    path: "/",
    title: t("homeTitle"),
    absoluteTitle: true,
    description: t("tagline"),
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tSite = await getTranslations("site");
  const recent = getRecentEditorials();

  return (
    <div>
      <JsonLd
        data={[
          organizationJsonLd(tSite("name")),
          websiteJsonLd({ siteName: tSite("name"), description: tSite("tagline"), locale }),
        ]}
      />
      <section className="hero-band">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <p className="label-code text-cherenkov-blue-800 dark:text-cherenkov-blue-300">{t("eyebrow")}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-foreground/80">{t("heroBody")}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/archive" className={buttonVariants({ size: "lg" })}>
              {t("ctaArchive")}
            </Link>
            <Link
              href="/syllabus"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("ctaSyllabus")}
            </Link>
            <Link
              href="/docs"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("ctaDocs")}
            </Link>
            <Link
              href="/about"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("ctaAbout")}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-14 pt-10 sm:px-6">
        <h2 className="label-code mb-4">{t("recentHeading")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("recentEmpty")}</p>
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
