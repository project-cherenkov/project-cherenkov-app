"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pure so it can be unit-tested directly, without rendering ThemeToggle
// (which needs a real React render pass for its hooks — see
// theme-toggle.test.tsx).
export function nextTheme(current: string | undefined) {
  return current === "dark" ? "light" : "dark";
}

function useThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    isDark: mounted && resolvedTheme === "dark",
    toggle: () => setTheme(nextTheme(resolvedTheme)),
  };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const { isDark, toggle } = useThemeToggle();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={t("toggleTheme")}
      className={`h-10 w-10 rounded-md text-muted-foreground hover:bg-card hover:text-foreground sm:h-11 sm:w-11 ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </Button>
  );
}

/** Full-width drawer row for the header's mobile menu. Leaves the drawer open so the change is visible. */
export function ThemeToggleRow({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const { isDark, toggle } = useThemeToggle();

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex min-h-12 w-full items-center gap-2 rounded-md px-3 text-left font-semibold text-foreground transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      {t("toggleTheme")}
    </button>
  );
}
