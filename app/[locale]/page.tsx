import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { EditorialCard } from "@/components/site/editorial-card";
import { JsonLd } from "@/components/seo/json-ld";
import { getRecentEditorials } from "@/lib/content";
import { getHomeVizCandidates } from "@/lib/home-viz-candidates";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";
import { HomeVisualizations } from "@/components/site/home-visualizations";
import { Credo } from "@/components/site/credo";

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
    description: t("homeDescription"),
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
  const vizCandidates = getHomeVizCandidates(locale);

  return (
    <div>
      <JsonLd
        data={[
          organizationJsonLd(tSite("name")),
          websiteJsonLd({ siteName: tSite("name"), description: tSite("homeDescription"), locale }),
        ]}
      />
      <section className="hero-band">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="grid gap-y-8 lg:grid-cols-2 lg:grid-rows-[auto_auto] lg:gap-x-8 lg:items-start">
            <div className="lg:col-start-1 lg:row-start-1">
              <p className="label-pixel text-cherenkov-blue-800 dark:text-cherenkov-blue-300" aria-hidden="true">{t("eyebrow")}</p>
              {/* The tagline is English in both languages by decision (see
                  docs/project/product-identity.md), so it is marked as such. */}
              {/* O1 (open): the hero line keeps the heading face. To make it
                  pixel, add `font-pixel` to this one element. */}
              <h1 lang="en" className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {t("heroTitle")}
              </h1>
              <Credo className="mt-5" />
              <p className="mt-4 max-w-xl text-lg text-foreground/80">{t("heroBody")}</p>

              {/* One primary and one secondary action. Syllabus, Docs and About
                  are in the header menu and the footer. */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/archive" className={buttonVariants({ size: "lg" })}>
                  {t("ctaArchive")}
                </Link>
                <Link
                  href="/docs/study-planner"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  {t("ctaPlan")}
                </Link>
              </div>
            </div>
            {/* ONE instance: the picker shares the top row with the hero text,
                while its visualization stage spans the full row below. */}
            <HomeVisualizations candidates={vizCandidates} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-14 pt-10 sm:px-6">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="heading-section">{t("recentHeading")}</h2>
          <Link
            href="/archive"
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            {t("seeAll")}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("recentEmpty")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.slice(0, 3).map((editorial) => (
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
