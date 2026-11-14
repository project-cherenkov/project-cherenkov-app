"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import NextLink from "next/link";
import { useSession } from "@/lib/auth-client";
import { Github, Menu, X } from "lucide-react";
import { SearchPalette } from "@/components/site/search-palette";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { UpdatesBell } from "@/components/site/updates-bell";
import { BrandMark } from "@/components/site/brand-mark";
import { NavRibbonArt } from "@/components/site/nav-ribbon-art";

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
//
// There are no flags: a flag stands for a country, not a language, and Windows
// ships no flag emoji at all, so there it drew the two letters "GB" and "ID"
// beside the visible EN / ID label.
const localeOptions = [
  { code: "en", label: "EN", name: "English" },
  { code: "id", label: "ID", name: "Bahasa Indonesia" },
] as const;

export function SiteHeader({ latestUpdateDate }: { latestUpdateDate?: string }) {
  const t = useTranslations("nav");
  const tFooter = useTranslations("footer");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [canEdit, setCanEdit] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    if (!session) {
      setCanEdit(false);
      return;
    }
    fetch("/api/account/edit-access", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { canEdit: false }))
      .then((result: { canEdit?: boolean }) => {
        if (active) setCanEdit(result.canEdit === true);
      })
      .catch(() => {
        if (active) setCanEdit(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

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

  /* A drawer that stays open after the route changes (browser back) or after
     the window is widened to the desktop ribbons would keep the body scroll
     locked behind an interface that no longer shows it. */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 857px)");
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setMobileMenuOpen(false);
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

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
    ...(canEdit ? [{ href: "/keystatic", label: t("edit"), isExternal: true }] : []),
    ...(session
      ? [
          { href: "/planner", label: t("myPlan"), isExternal: false },
          { href: "/account", label: t("account"), isExternal: false },
        ]
      : [{ href: "/account", label: t("account"), isExternal: false }]),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur overflow-visible">
      <div className="mx-auto flex h-11 max-w-5xl items-center justify-between gap-2 px-3 py-3.5 sm:gap-3 sm:px-6 overflow-visible">
        <Link href="/" className="flex items-center gap-2 z-10 shrink-0">
          <BrandMark className="h-6 w-6 text-cherenkov-blue-700 dark:text-cherenkov-blue-pastel" />
          {/* Below 360px the bar cannot hold the wordmark beside the controls and
              the ribbon; the mark stays and the name is kept for screen readers. */}
          <span className="sr-only font-heading text-base font-bold tracking-tight text-foreground min-[360px]:not-sr-only">
            cherenkov
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 overflow-visible">
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
                "nav-ribbon group relative -mt-2 inline-flex h-28 w-24 shrink-0 items-center justify-center p-2 pt-4 transition-transform duration-300 ease-out focus-visible:outline-none",
                // Current page: drops 12px. Hover or keyboard focus: drops 8px.
                // (It dropped 36px on hover until now; docs/reviews/design-
                // review-2026-10.md already described 8px.)
                isActive ? "translate-y-3 z-30" : "z-20 hover:translate-y-2 focus-visible:translate-y-2",
              ].join(" ");

              const content = (
                <>
                  <NavRibbonArt className="pointer-events-none drop-shadow-md" />
                  <span className="nav-ribbon-label relative z-10 text-center font-bold text-xs leading-tight px-1 pb-3">
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
          <div className="flex items-center gap-0.5 sm:gap-1.5 font-mono text-xs z-10 overflow-visible shrink-0">
            <SearchPalette />
            <UpdatesBell latestUpdateDate={latestUpdateDate} />
            <ThemeToggle />

            <div
              role="group"
              aria-label={t("language")}
              className="flex items-center gap-0.5 rounded-full border border-border bg-white/70 p-0.5 shadow-sm sm:gap-1 sm:p-1 dark:bg-slate-800/70"
            >
              {localeOptions.map(({ code, label, name }) => {
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
                      "inline-flex min-h-9 items-center rounded-full px-2 transition-colors text-xs sm:px-2.5",
                      isActive
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
                    ].join(" ")}
                  >
                    <span className="font-semibold leading-none">{label}</span>
                    {/* Full language name for screen readers, appended to the
                        visible code so the accessible name starts with what is
                        on screen (WCAG 2.5.3), e.g. "EN English". */}
                    <span className="sr-only"> {name}</span>
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

            {/* Menu ribbon, shown below 857px. It hangs from the top edge like the
                desktop ribbons but is drawn at the artwork's own proportions
                (64x72 against 285x300) and carries an icon, so it reads as a
                button and shows its state: a hamburger when closed, a cross when
                open. It no longer slides down when open, which is what used to
                park it on top of the first drawer row.
                No aria-label on purpose: the visible word "Menu" IS the
                accessible name (WCAG 2.5.3 Label in Name); aria-expanded
                carries the open/closed state. */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              className="nav-ribbon group relative z-30 inline-flex h-[4.5rem] w-16 flex-col items-center justify-start gap-0.5 pt-5 transition-transform duration-200 ease-out focus-visible:outline-none min-[857px]:hidden [@media(hover:hover)]:hover:translate-y-1"
            >
              <NavRibbonArt className="pointer-events-none drop-shadow-md" />
              {mobileMenuOpen ? (
                <X className="nav-ribbon-label relative z-10 h-4 w-4" aria-hidden />
              ) : (
                <Menu className="nav-ribbon-label relative z-10 h-4 w-4" aria-hidden />
              )}
              <span className="nav-ribbon-label relative z-10 text-center font-mono text-xs font-bold uppercase leading-none tracking-wider">
                {t("menu")}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Drawer Menu.
          Laid over the page (absolute, under the bar) instead of inside the
          flow, so opening it no longer pushes the page down, and a scrim dims
          what is behind it and closes it on tap. Its top padding clears the
          ribbon's tip, which hangs ~13px below the bar. Both layers sit under
          the bar's own controls (z-10) so the ribbon is drawn over the drawer
          and keeps its V-shaped tip. */}
      {mobileMenuOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-x-0 top-full z-[1] h-[100dvh] bg-cherenkov-ink/40 min-[857px]:hidden"
          />
          <div
            id="mobile-nav"
            className="absolute inset-x-0 top-full z-[2] max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain border-t border-border bg-background px-4 pb-4 pt-5 shadow-lg min-[857px]:hidden"
          >
            <nav
              aria-label={t("mainNavigation")}
              className="mx-auto flex max-w-5xl flex-col gap-1 font-mono text-sm uppercase tracking-wide"
            >
              {navItems.map((item) => {
                const isActive = item.href
                  ? item.activeFor
                    ? item.activeFor.some((href) => isWithin(pathname, href))
                    : pathname === item.href
                  : false;

                const rowClasses = (active: boolean) =>
                  [
                    "flex min-h-12 items-center rounded-md px-3 font-semibold transition-colors",
                    active
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-foreground hover:bg-slate-100 dark:hover:bg-slate-800",
                  ].join(" ");

                if (item.isExternal) {
                  return (
                    <NextLink
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={rowClasses(false)}
                    >
                      {item.label}
                    </NextLink>
                  );
                }

                if (item.children) {
                  // The group's own row is a plain link: the child that is
                  // current carries the fill, so two rows are never filled
                  // for one page.
                  return (
                    <div key={item.href} className="flex flex-col gap-1">
                      <Link
                        href={item.href!}
                        onClick={() => setMobileMenuOpen(false)}
                        className={rowClasses(false)}
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
                              className={rowClasses(childActive)}
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
                    className={rowClasses(isActive)}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* The bar hides the GitHub icon below 640px, which left no way
                  to reach the repository on a phone. It is a row here instead. */}
              <a
                href="https://github.com/project-cherenkov/project-cherenkov-app"
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center gap-2 rounded-md px-3 font-semibold text-foreground transition-colors hover:bg-slate-100 sm:hidden dark:hover:bg-slate-800"
              >
                <Github className="h-4 w-4" aria-hidden />
                {t("repo")}
                <span className="sr-only"> {tFooter("opensInNewTab")}</span>
              </a>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
