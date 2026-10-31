import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Markdown from "react-markdown";

import { readLegalDoc } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return pageMetadata({
    locale,
    path: "/privacy",
    title: t("privacy.title"),
    description: t("privacy.description"),
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const source = await readLegalDoc("privacy", locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <article className="prose prose-slate max-w-none dark:prose-invert">
        <Markdown>{source}</Markdown>
      </article>
    </div>
  );
}
