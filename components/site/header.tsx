"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import NextLink from "next/link";
import { useSession, signOut } from "@/lib/auth-client";

export function SiteHeader() {
  const t = useTranslations("nav");
  const { data: session } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-cherenkov-offwhite/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-cherenkov-blue-pastel"
          />
          <span className="font-mono text-sm font-semibold tracking-tight text-slate-900">
            cherenkov
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 font-mono text-xs uppercase tracking-wide">
          <Link
            href="/archive"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
          >
            {t("archive")}
          </Link>
          <Link
            href="/about"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
          >
            {t("about")}
          </Link>
          <NextLink
            href="/keystatic"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
          >
            {t("edit")}
          </NextLink>
          <a
            href="https://github.com/project-cherenkov/project-cherenkov-app"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
          >
            {t("repo")}
          </a>

          {session ? (
            <>
              <Link
                href="/planner"
                className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
              >
                {t("myPlan")}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900 cursor-pointer"
              >
                {t("logout")}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
              >
                {t("login")}
              </Link>
              <Link
                href="/signup"
                className="rounded-md px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-900"
              >
                {t("signup")}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
