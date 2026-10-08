import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLd } from "@/components/seo/json-ld";
import { Link } from "@/i18n/routing";
import { getDocSections } from "@/lib/docs";
import { breadcrumbJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });
  return pageMetadata({
    locale,
    path: "/docs",
    title: t("title"),
    description: t("description"),
  });
}

export default async function DocsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("docs");
  const sections = getDocSections(locale);

  return (
    <div>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: t("title") }])} />
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">{t("description")}</p>

      <div className="mt-8 space-y-10">
        {sections.map(({ section, entries }) => (
          <section key={section} aria-labelledby={`section-${section}`}>
            <h2
              id={`section-${section}`}
              className="border-b border-border pb-2 text-xl font-semibold text-foreground"
            >
              {t(`sections.${section}`)}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {entries.map(({ doc }) => (
                <li key={doc.slug}>
                  <Link
                    href={`/docs/${doc.slug}`}
                    className="group flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-cherenkov-blue-700 dark:hover:border-cherenkov-blue-pastel"
                  >
                    <span className="text-lg font-semibold text-foreground group-hover:underline">
                      {doc.title}
                    </span>
                    <span className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {doc.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
