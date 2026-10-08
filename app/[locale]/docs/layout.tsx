import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { DocsNav } from "@/components/docs/docs-nav";
import { getDocSections } from "@/lib/docs";

export default async function DocsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Only plain, serializable data crosses into the client sidebar.
  const sections = getDocSections(locale).map(({ section, entries }) => ({
    section,
    entries: entries.map(({ doc }) => ({ slug: doc.slug, title: doc.title })),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
      <aside className="mb-8 lg:mb-0">
        <DocsNav sections={sections} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
