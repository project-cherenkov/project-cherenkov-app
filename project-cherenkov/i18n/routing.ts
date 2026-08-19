import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

// ASSUMPTION (spec doesn't pin locales down, only says "nest under a
// [locale] segment via next-intl middleware" — Section 5): defaulting to
// Indonesian as primary with English as a secondary locale, since this is
// an Indonesian OSN project. Flag back if that's wrong — adding/removing a
// locale is just editing this array plus messages/<locale>.json.
export const routing = defineRouting({
  locales: ["id", "en"],
  defaultLocale: "id",
});

// Locale-aware wrappers — use these instead of next/navigation everywhere
// under app/[locale], so links stay on the current locale automatically.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
