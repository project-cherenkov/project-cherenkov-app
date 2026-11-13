import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/site/error-state";

// Own title, and no description: the layout's default is the home page's, which
// is wrong for an error page.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });
  return { title: t("title"), description: null, robots: { index: false, follow: false } };
}

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <ErrorState
      eyebrow="404.md"
      heading={t("heading")}
      body={t("body")}
      ctaLabel={t("cta")}
      ctaHref="/"
    />
  );
}
