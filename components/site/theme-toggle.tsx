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

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleTheme() {
    setTheme(nextTheme(resolvedTheme));
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={t("toggleTheme")}
      className="h-11 w-11 rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
