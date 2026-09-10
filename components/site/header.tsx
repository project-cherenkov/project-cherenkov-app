"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import NextLink from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { Github } from "lucide-react";
import { ThemeToggle } from "@/components/site/theme-toggle";

const localeOptions = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "id", label: "ID", flag: "🇮🇩" },
] as const;

export function SiteHeader() {
  const t = useTranslations("nav");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* Lock body scroll when mobileMenuOpen is true */
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  const navItems = [
    { href: "/archive", label: t("archive"), isExternal: false },
    { href: "/about", label: t("about"), isExternal: false },
    { href: "/keystatic", label: t("edit"), isExternal: true },
    ...(session
      ? [
          { href: "/planner", label: t("myPlan"), isExternal: false },
          { onClick: handleSignOut, label: t("logout"), isButton: true },
        ]
      : [
          { href: "/login", label: t("login"), isExternal: false },
          { href: "/signup", label: t("signup"), isExternal: false },
        ]),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur overflow-visible">
      <div className="mx-auto flex h-11 max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 overflow-visible">
        <Link href="/" className="flex items-center gap-2 z-10 shrink-0">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-cherenkov-blue-pastel"
          />
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            cherenkov
          </span>
        </Link>

        <div className="flex items-center gap-2 overflow-visible">
          {/* Desktop Navigation: Active at 857px and above with fixed dimensions */}
          <nav className="hidden min-[857px]:flex items-center gap-2 font-mono text-xs uppercase tracking-wide overflow-visible z-20 shrink-0">
            {navItems.map((item, index) => {
              const isActive = item.href ? pathname === item.href : false;

              const bookmarkStyle = [
                "group relative -mt-2 inline-flex h-28 w-24 shrink-0 items-center justify-center p-2 pt-4 transition-transform duration-300 ease-out focus:outline-none",
                isActive ? "translate-y-9 z-30" : "z-20 hover:translate-y-9",
              ].join(" ");

              const content = (
                <>
                  <Image
                    src="/mbantul2.png"
                    alt=""
                    fill
                    sizes="96px"
                    priority
                    className="object-fill pointer-events-none drop-shadow-md"
                  />
                  <span className="relative z-10 text-center font-bold text-white dark:text-slate-100 text-[11px] leading-tight px-1 pb-3">
                    {item.label}
                  </span>
                </>
              );

              if (item.isButton) {
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={item.onClick}
                    className={bookmarkStyle}
                  >
                    {content}
                  </button>
                );
              }

              if (item.isExternal) {
                return (
                  <NextLink key={item.href} href={item.href} className={bookmarkStyle}>
                    {content}
                  </NextLink>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={bookmarkStyle}>
                  {content}
                </Link>
              );
            })}
          </nav>

          {/* Controls Right */}
          <div className="flex items-center gap-1.5 font-mono text-xs z-10 overflow-visible shrink-0">
            <ThemeToggle />

            <div className="flex items-center gap-1 rounded-full border border-border bg-white/70 p-1 shadow-sm dark:bg-slate-800/70">
              {localeOptions.map(({ code, label, flag }) => {
                const isActive = code === currentLocale;

                return (
                  <Link
                    key={code}
                    href={pathname}
                    locale={code}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors text-xs",
                      isActive
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
                    ].join(" ")}
                    aria-label={`Switch language to ${label}`}
                  >
                    <span aria-hidden="true">{flag}</span>
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
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-md border border-border p-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Github className="h-4 w-4" aria-hidden />
            </a>

            {/* Single Bookmark Menu Toggle: Displays at 856px or smaller */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle Navigation"
              className={[
                "group relative min-[857px]:hidden -mt-2 inline-flex h-20 w-16 items-center justify-center p-1 pt-3 transition-transform duration-300 ease-out focus:outline-none z-30",
                mobileMenuOpen ? "translate-y-5" : "hover:translate-y-2",
              ].join(" ")}
            >
              <Image
                src="/mbantul2.png"
                alt=""
                fill
                sizes="64px"
                priority
                className="object-fill pointer-events-none drop-shadow-md"
              />
              <span className="relative z-10 text-center font-mono font-bold text-white dark:text-slate-100 text-[10px] uppercase tracking-widest leading-none pb-2">
                MENU
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Drawer Menu */}
      {mobileMenuOpen && (
        <div className="min-[857px]:hidden border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <nav className="flex flex-col gap-2 font-mono text-xs uppercase tracking-wide">
            {navItems.map((item, index) => {
              const isActive = item.href ? pathname === item.href : false;

              const linkClasses = [
                "flex items-center rounded-md px-3 py-2.5 transition-colors font-semibold",
                isActive
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              ].join(" ");

              if (item.isButton) {
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      item.onClick?.();
                    }}
                    className={`${linkClasses} w-full text-left`}
                  >
                    {item.label}
                  </button>
                );
              }

              if (item.isExternal) {
                return (
                  <NextLink
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={linkClasses}
                  >
                    {item.label}
                  </NextLink>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={linkClasses}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}