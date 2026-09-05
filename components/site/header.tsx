"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import NextLink from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { Github } from "lucide-react";
import { ThemeToggle } from "@/components/site/theme-toggle";

function FlagGB() {
  return (
    <svg className="h-3 w-4 rounded-[1px] shadow-sm" viewBox="0 0 60 30" aria-hidden="true">
      <clipPath id="gb-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="gb-t">
        <path d="M30,15 h30 v15 z m0,0 h-30 v-15 z m0,0 h-30 v15 z m0,0 h30 v-15 z" />
      </clipPath>
      <g clipPath="url(#gb-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#gb-t)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

function FlagID() {
  return (
    <svg className="h-3 w-4 rounded-[1px] border border-slate-300/50 shadow-sm" viewBox="0 0 3 2" aria-hidden="true">
      <rect width="3" height="1" fill="#E70011" />
      <rect y="1" width="3" height="1" fill="#FFFFFF" />
    </svg>
  );
}

const localeOptions = [
  { code: "en", label: "EN", Flag: FlagGB },
  { code: "id", label: "ID", Flag: FlagID },
] as const;

export function SiteHeader() {
  const t = useTranslations("nav");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-cherenkov-blue-pastel"
          />
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            cherenkov
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap items-center gap-1 font-mono text-xs uppercase tracking-wide">
            <Link
              href="/archive"
              className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {t("archive")}
            </Link>
            <Link
              href="/about"
              className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {t("about")}
            </Link>
            <NextLink
              href="/keystatic"
              className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {t("edit")}
            </NextLink>

            {session ? (
              <>
                <Link
                  href="/planner"
                  className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {t("myPlan")}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="cursor-pointer rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {t("signup")}
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <ThemeToggle />

            <div className="flex items-center gap-1 rounded-full border border-border bg-white/70 p-1 shadow-sm dark:bg-slate-800/70">
              {localeOptions.map(({ code, label, Flag }) => {
                const isActive = code === currentLocale;

                return (
                  <Link
                    key={code}
                    href={pathname}
                    locale={code}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors",
                      isActive
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
                    ].join(" ")}
                    aria-label={`Switch language to ${label}`}
                  >
                    <Flag />
                    <span className="font-semibold leading-none">{label}</span>
                  </Link>
                );
              })}
            </div>

            <a
              href="https://github.com/project-cherenkov/project-cherenkov-app"
              target="_blank"
              rel="noreferrer"
              aria-label={t("repo")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border p-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Github className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
