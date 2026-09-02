"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pure so it can be unit-tested directly, without rendering ThemeToggle
// (which needs a real React render pass for its hooks — see
// theme-toggle.test.tsx).
export function nextTheme(current: string | undefined) {
  return current === "dark" ? "light" : "dark";
}

export function ThemeToggle() {
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
      aria-label="Toggle theme"
      className="h-8 w-8 rounded-md text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
