/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let mockPathname = "/about";

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: null }),
  signOut: vi.fn(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn(), resolvedTheme: "light" }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, locale, children, ...props }: any) => (
    <a href={locale ? `/${locale}${href}` : href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { SiteHeader } from "./header";

// The active bookmark carries aria-current="true" (it stands for three
// sections, so it is not aria-current="page"). Asserting the attribute rather
// than a styling class keeps this test valid when the ribbon's look changes.
function archiveIsActive(pathname: string): boolean {
  mockPathname = pathname;
  const html = renderToStaticMarkup(<SiteHeader />);
  const archiveAnchor = html.match(/<a href="\/archive"[^>]*>/)?.[0] ?? "";
  return archiveAnchor.includes('aria-current="true"');
}

describe("SiteHeader — Archive bookmark covers all three archive sections", () => {
  it.each(["/archive", "/archive/informatics/x", "/syllabus", "/syllabus/physics", "/materials", "/materials/informatics/binary-search"])(
    "is active on %s",
    (pathname) => expect(archiveIsActive(pathname)).toBe(true),
  );

  it.each(["/about", "/", "/planner"])("is not active on %s", (pathname) =>
    expect(archiveIsActive(pathname)).toBe(false),
  );
});
