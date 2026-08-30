/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      heading: "Page not found",
      body: "The page you are looking for doesn't exist or has been moved.",
      cta: "Back to home",
    };
    return translations[key] ?? key;
  },
}));

vi.mock("@/i18n/routing", () => ({
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
});
