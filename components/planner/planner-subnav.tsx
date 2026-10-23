"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/routing";

// Links between the study tools: plan, progress, missed questions and timer
// (R2-R4). Lives in app/[locale]/planner/layout.tsx so every planner page
// shares it; the timer page renders it too, so the tools feel like one place.
const ITEMS = [
  { href: "/planner", key: "plan", exact: true },
  { href: "/planner/progress", key: "progress", exact: false },
  { href: "/planner/review", key: "review", exact: false },
  { href: "/timer", key: "timer", exact: false },
] as const;

export function PlannerSubnav() {
  const t = useTranslations("studyTools");
  const pathname = usePathname();

  return (
    <nav aria-label={t("navLabel")} className="border-b border-border">
      <ul className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-4 py-2 sm:px-6">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium",
                  active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-foreground hover:bg-slate-100 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
        <li className="ml-auto">
          <Link
            href="/docs/study-planner"
            className="inline-flex min-h-10 items-center rounded-md px-3 text-sm text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
          >
            {t("help")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
