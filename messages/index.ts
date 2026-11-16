import type { Locale } from "@/i18n/routing";

type Messages = typeof import("./en").default;

// Each locale is its own dynamic import so a request only loads one catalogue.
// Typing the id loader as returning en's shape makes a missing top-level
// namespace or key a compile error, not just a test failure.
const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: () => import("./en"),
  id: () => import("./id"),
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await loaders[locale]()).default;
}
