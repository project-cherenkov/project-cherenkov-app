"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/routing";

// Shared by the three archive sections (syllabus, materials, editorials). It
// is a plain link bar — <nav> + aria-current — not an ARIA tablist: each tab
// is its own URL, so links are the correct semantics, they work without JS
// and they stay reachable by keyboard and touch (no hover dependence).
//
// Editorials keep their existing /archive URLs; only the *grouping* is new.
const TABS = [
  { href: "/syllabus", labelKey: "syllabus" },
  { href: "/materials", labelKey: "materials" },
  { href: "/archive", labelKey: "editorials" },
] as const;

export function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ArchiveSubnav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  // min-[857px]:pt-11 — on desktop the header's hanging ribbons reach ~87px
  // below the viewport top; this clears them so they never sit on top of (or
  // steal clicks from) the tabs. Below 857px the ribbons collapse into the Menu
  // drawer, so no extra space is needed.
  return (
    <nav aria-label={t("archiveSections")} className="border-b border-border min-[857px]:pt-11">
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 font-mono text-xs uppercase tracking-wide sm:px-6">
        {TABS.map(({ href, labelKey }) => {
          const active = isTabActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 transition-colors",
                  active
                    ? "border-cherenkov-blue-600 font-semibold text-foreground dark:border-cherenkov-blue-pastel"
                    : "border-transparent text-slate-500 hover:text-foreground dark:text-slate-400",
                ].join(" ")}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
