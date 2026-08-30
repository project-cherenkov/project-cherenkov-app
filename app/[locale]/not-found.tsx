import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/site/error-state";

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
