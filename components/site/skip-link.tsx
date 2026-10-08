import { useTranslations } from "next-intl";

// First focusable element on every page (WCAG 2.4.1 Bypass Blocks): without
// it, keyboard and screen-reader users tab through the whole header —
// including the bookmark nav — on every single page load. Visually hidden
// until it receives focus.
export function SkipLink() {
  const t = useTranslations("nav");
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background"
    >
      {t("skipToContent")}
    </a>
  );
}
