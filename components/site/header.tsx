"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import NextLink from "next/link";
import { useSession } from "@/lib/auth-client";
import { Github } from "lucide-react";
import { ThemeToggle } from "@/components/site/theme-toggle";

// The "Archive" bookmark stands for three sections (see archive-subnav.tsx), so
// it stays highlighted on any of them, not just on /archive itself.
const ARCHIVE_SECTIONS = [
  { href: "/syllabus", labelKey: "syllabus" },
  { href: "/materials", labelKey: "materials" },
  { href: "/archive", labelKey: "editorials" },
] as const;

function isWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// `name` is the language's own name for itself and is deliberately NOT
// translated: someone who needs to find the Indonesian site should be able to
// find "Bahasa Indonesia" even when the page is currently in English.
const localeOptions = [
  { code: "en", label: "EN", name: "English", flag: "🇬🇧" },
  { code: "id", label: "ID", name: "Bahasa Indonesia", flag: "🇮🇩" },
] as const;

export function SiteHeader() {
  const t = useTranslations("nav");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  /* Escape closes the drawer and hands focus back to the button that opened
     it (WCAG 2.1.1 / 2.4.3) — otherwise a keyboard user has to tab all the way
     back through the drawer to dismiss it. */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

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

  const navItems = [
    {
      href: "/archive",
      label: t("archive"),
      isExternal: false,
      // Highlighted on all three archive sections; the mobile drawer also
      // lists them as an indented group under this item.
      activeFor: ARCHIVE_SECTIONS.map((entry) => entry.href),
      children: ARCHIVE_SECTIONS.map((entry) => ({
        href: entry.href,
        label: t(entry.labelKey),
      })),
    },
    { href: "/about", label: t("about"), isExternal: false },
    { href: "/keystatic", label: t("edit"), isExternal: true },
    ...(session
      ? [
          { href: "/planner", label: t("myPlan"), isExternal: false },
          { href: "/account", label: t("account"), isExternal: false },
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
          <nav
            aria-label={t("mainNavigation")}
            className="hidden min-[857px]:flex items-center gap-2 font-mono text-xs uppercase tracking-wide overflow-visible z-20 shrink-0"
          >
            {navItems.map((item) => {
              const isActive = item.href
                ? item.activeFor
                  ? item.activeFor.some((href) => isWithin(pathname, href))
                  : pathname === item.href
                : false;

              const bookmarkStyle = [
                "group relative -mt-2 inline-flex h-28 w-24 shrink-0 items-center justify-center p-2 pt-4 transition-transform duration-300 ease-out focus:outline-none",
                isActive ? "translate-y-9 z-30" : "z-20 hover:translate-y-9",
              ].join(" ");

              const content = (
                <>
                  <Image
                    src="/navbar-banner-extended.png"
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

              if (item.isExternal) {
                return (
                  <NextLink key={item.href} href={item.href} className={bookmarkStyle}>
                    {content}
                  </NextLink>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  className={bookmarkStyle}
                  aria-current={isActive ? (item.activeFor ? "true" : "page") : undefined}
                >
                  {content}
                </Link>
              );
            })}
          </nav>

          {/* Controls Right */}
          <div className="flex items-center gap-1.5 font-mono text-xs z-10 overflow-visible shrink-0">
            <ThemeToggle />

            <div
              role="group"
              aria-label={t("language")}
              className="flex items-center gap-1 rounded-full border border-border bg-white/70 p-1 shadow-sm dark:bg-slate-800/70"
            >
              {localeOptions.map(({ code, label, name, flag }) => {
                const isActive = code === currentLocale;

                return (
                  <Link
                    key={code}
                    href={pathname}
                    locale={code}
                    lang={code}
                    hrefLang={code}
                    aria-current={isActive ? "true" : undefined}
                    className={[
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 transition-colors text-xs",
                      isActive
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
                    ].join(" ")}
                    aria-label={`${name} (${label})`}
                  >
                    <span aria-hidden="true" className="hidden min-[420px]:inline">
                      {flag}
                    </span>
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
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-md border border-border p-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Github className="h-4 w-4" aria-hidden />
            </a>

            {/* Single Bookmark Menu Toggle: Displays at 856px or smaller */}
            {/* No aria-label on purpose: the visible word "Menu" IS the
                accessible name (WCAG 2.5.3 Label in Name). The old label,
                "Toggle Navigation", did not contain the visible text. */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              className={[
                "group relative min-[857px]:hidden -mt-2 inline-flex h-20 w-16 items-center justify-center p-1 pt-3 transition-transform duration-300 ease-out focus:outline-none z-30",
                mobileMenuOpen ? "translate-y-5" : "hover:translate-y-2",
              ].join(" ")}
            >
              <Image
                src="/navbar-banner-extended.png"
                alt=""
                fill
                sizes="64px"
                priority
                className="object-fill pointer-events-none drop-shadow-md"
              />
              <span className="relative z-10 text-center font-mono font-bold text-white dark:text-slate-100 text-[10px] uppercase tracking-widest leading-none pb-2">
                {t("menu")}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav"
          className="min-[857px]:hidden border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur"
        >
          <nav
            aria-label={t("mainNavigation")}
            className="flex flex-col gap-2 font-mono text-xs uppercase tracking-wide"
          >
            {navItems.map((item) => {
              const isActive = item.href
                ? item.activeFor
                  ? item.activeFor.some((href) => isWithin(pathname, href))
                  : pathname === item.href
                : false;

              const linkClasses = [
                "flex items-center rounded-md px-3 py-2.5 transition-colors font-semibold",
                isActive
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              ].join(" ");

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

              if (item.children) {
                return (
                  <div key={item.href} className="flex flex-col gap-2">
                    <Link
                      href={item.href!}
                      onClick={() => setMobileMenuOpen(false)}
                      className={linkClasses}
                    >
                      {item.label}
                    </Link>
                    <div className="ml-3 flex flex-col gap-1 border-l border-border pl-3">
                      {item.children.map((child) => {
                        const childActive = isWithin(pathname, child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            aria-current={childActive ? "page" : undefined}
                            className={[
                              "flex min-h-11 items-center rounded-md px-3 transition-colors",
                              childActive
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                : "text-foreground hover:bg-accent hover:text-accent-foreground",
                            ].join(" ")}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
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