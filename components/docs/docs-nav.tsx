"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/routing";

export interface DocsNavSection {
  section: string;
  entries: { slug: string; title: string }[];
}

function NavList({ sections }: { sections: DocsNavSection[] }) {
  const t = useTranslations("docs");
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      {sections.map(({ section, entries }) => (
        <div key={section}>
          <p className="label-code mb-2">{t(`sections.${section}`)}</p>
          <ul className="space-y-0.5 border-l border-border">
            {entries.map((entry) => {
              const href = `/docs/${entry.slug}`;
              const active = pathname === href;
              return (
                <li key={entry.slug}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "-ml-px flex min-h-11 items-center border-l-2 px-3 text-sm transition-colors",
                      active
                        ? "border-cherenkov-blue-700 font-semibold text-foreground dark:border-cherenkov-blue-pastel"
                        : "border-transparent text-slate-600 hover:text-foreground dark:text-slate-300",
                    ].join(" ")}
                  >
                    {entry.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Wide screens: always-visible sidebar. Narrow screens: the same list inside a
// native <details> disclosure (keyboard- and screen-reader-operable with no
// JavaScript state to manage). The two copies are never visible together, so
// assistive tech only ever sees one of them.
export function DocsNav({ sections }: { sections: DocsNavSection[] }) {
  const t = useTranslations("docs");
  return (
    <>
      <nav aria-label={t("navLabel")} className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <NavList sections={sections} />
      </nav>
      <details className="rounded-md border border-border lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-mono text-xs uppercase tracking-wide">
          {t("browse")}
        </summary>
        <nav aria-label={t("navLabel")} className="border-t border-border p-4">
          <NavList sections={sections} />
        </nav>
      </details>
    </>
  );
}
