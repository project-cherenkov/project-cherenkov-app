/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      heading: "Page not found",
      body: "The page you are looking for doesn't exist or has been moved.",
      cta: "Back to home",
      another: "Show another fragment",
    };
    return translations[key] ?? key;
  },
  useLocale: () => "en",
}));

vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/en/syllabus/nothing-here",
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import NotFound from "@/app/[locale]/not-found";

describe("NotFound", () => {
  it("renders translated heading, body, CTA, and link to home", () => {
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).toContain("Page not found");
    expect(html).toContain("The page you are looking for");
    expect(html).toContain("Back to home");
    expect(html).toContain('href="/"');
    expect(html).toContain("404.md");
  });

  it("is the corrupted screen: decorative code, a flavour slot and the swap button", () => {
    const html = renderToStaticMarkup(<NotFound />);

    // The big code is decoration; the heading carries the meaning.
    expect(html).toMatch(/class="cx-code[^"]*"[^>]*aria-hidden="true"/);
    // The block layer is decoration too.
    expect(html).toMatch(/class="cx-layer" aria-hidden="true"/);
    // The flavour line is announced politely when it changes, and is empty
    // until the page has loaded (it is picked at random after hydration).
    expect(html).toMatch(/<p class="cx-flavour[^"]*" aria-live="polite"><\/p>/);
    expect(html).toContain("Show another fragment");
  });
});
