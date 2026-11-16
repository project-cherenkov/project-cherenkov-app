import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { useLocale, useTranslations } from "next-intl";
import { ErrorState } from "@/components/site/error-state";
import { flavourFor } from "@/lib/error-flavour";

// Own title, and no description: the layout's default is the home page's, which
// is wrong for an error page.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });
  return { title: t("title"), description: null, robots: { index: false, follow: false } };
}

export default function NotFound() {
  const t = useTranslations("notFound");
  const locale = useLocale();

  return (
    <>
      {/* generateMetadata is not applied to not-found in this setup, so a 404
          showed the home page's <title>. React 19 hoists a <title> rendered
          here into <head>, and the robots tag with it. */}
      <title>{t("title")}</title>
      <meta name="robots" content="noindex, nofollow" />
      <ErrorState
      eyebrow="404.md"
      code="404"
      heading={t("heading")}
      body={t("body")}
      ctaLabel={t("cta")}
      ctaHref="/"
      flavour={flavourFor(locale, "notFound")}
      anotherLabel={t("another")}
      echoPath
    />
    </>
  );
}
