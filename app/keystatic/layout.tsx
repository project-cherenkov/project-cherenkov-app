import type { ReactNode } from "react";
import Link from "next/link";

// Wraps every /keystatic/* route — the dashboard and every collection/
// singleton path (rendered by <KeystaticApp/>, via
// app/keystatic/[[...params]]/page.tsx) as well as this project's own
// pages (/keystatic/scene-builder, /keystatic/scene-builder/new,
// /keystatic/team-photo) — with a persistent "+ New visualization" entry
// point.
//
// This is NOT the same file that used to live here and swallow every
// nested page (see the comment in [[...params]]/page.tsx for that history)
// — this one actually renders `children`, which is what makes adding
// something here safe this time.
//
// Why a floating button instead of a real item in Keystatic's own
// sidebar/dashboard: @keystatic/core's `ui.navigation` config option only
// accepts existing collection/singleton keys (verified directly against
// its own .d.ts, not assumed) — there is no supported way to add a custom
// link or action into Keystatic's generated nav. This renders *alongside*
// whatever Keystatic screen is showing, not inside its React tree, so it
// survives regardless of which one that is.
export default function KeystaticSectionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Link
        href="/keystatic/scene-builder/new"
        className="fixed bottom-5 right-5 z-[999] inline-flex items-center gap-2 rounded-full bg-cherenkov-blue px-4 py-3 text-sm font-medium text-slate-900 shadow-lg transition-colors hover:bg-cherenkov-blue-pastel"
      >
        <span aria-hidden="true">+</span> New visualization
      </Link>
    </>
  );
}
