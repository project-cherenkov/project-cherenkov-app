"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminFloatingLinks() {
  const pathname = usePathname();
  if (pathname === "/keystatic/quiz-bank") return null;

  return <div className="fixed bottom-5 right-5 z-[999] flex gap-2">
    <Link href="/keystatic/quiz-bank" className="inline-flex items-center rounded-full border border-border-strong bg-background px-4 py-3 text-sm font-medium text-foreground shadow-lg transition-colors hover:bg-muted">
      Quiz bank
    </Link>
    <Link href="/keystatic/scene-builder/new" className="inline-flex items-center gap-2 rounded-full bg-cherenkov-blue px-4 py-3 text-sm font-medium text-cherenkov-ink shadow-lg transition-colors hover:bg-cherenkov-blue-pastel">
      <span aria-hidden="true">+</span> New visualization
    </Link>
  </div>;
}
