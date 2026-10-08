/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockUseSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  useSession: () => mockUseSession(),
  signOut: () => mockSignOut(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    resolvedTheme: "light",
  }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      archive: "Archive",
      about: "About",
      repo: "GitHub",
      edit: "Edit",
      login: "Log In",
      signup: "Sign Up",
      myPlan: "My Plan",
      account: "Account",
      toggleTheme: "Toggle theme",
      menu: "Menu",
      mainNavigation: "Main navigation",
      language: "Language",
    };
    return translations[key] ?? key;
  },
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, locale, children, ...props }: any) => (
    <a
      href={locale ? `/${locale}${href === "/" ? "" : href}` : href}
      {...props}
    >
      {children}
    </a>
  ),
  usePathname: () => "/about",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { SiteHeader } from "./header";

describe("SiteHeader — session awareness", () => {
  it("renders Edit link, GitHub repo link, and Log In/Sign Up when logged out", () => {
    mockUseSession.mockReturnValue({ data: null });

    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('href="/keystatic"');
    expect(html).toContain("Edit");
    expect(html).toContain("Archive");
    expect(html).toContain("About");
    expect(html).toContain('aria-label="GitHub"');
    expect(html).toContain('aria-label="Toggle theme"');
    expect(html).toContain('href="/login"');
    expect(html).toContain("Log In");
    expect(html).toContain('href="/signup"');
    expect(html).toContain("Sign Up");
    expect(html).not.toContain("My Plan");
    expect(html).not.toContain("Account");
  });

  it("renders Edit link, My Plan, Account (not Log Out), and Theme Toggle when logged in", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: "u1", name: "User", email: "user@example.com" },
      },
    });

    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('href="/keystatic"');
    expect(html).toContain("Edit");
    expect(html).toContain('href="/planner"');
    expect(html).toContain("My Plan");
    expect(html).toContain('href="/account"');
    expect(html).toContain("Account");
    expect(html).not.toContain("Log Out");
    expect(html).toContain('aria-label="Toggle theme"');
    expect(html).toContain('aria-label="GitHub"');
    expect(html).not.toContain("Log In");
    expect(html).not.toContain("Sign Up");
  });

  it("renders both locale options with flags and locale labels", () => {
    mockUseSession.mockReturnValue({ data: null });

    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain("EN");
    expect(html).toContain("ID");
    expect(html).toContain("<svg");
    expect(html).toContain('href="/id/about"');
    expect(html).toContain('href="/en/about"');
  });
});

// Accessibility behaviour added in the SEO/a11y pass.
describe("SiteHeader — accessibility", () => {
  function render() {
    mockUseSession.mockReturnValue({ data: null });
    return renderToStaticMarkup(<SiteHeader />);
  }

  it("names the menu button by its visible text (WCAG 2.5.3) and exposes its state", () => {
    const html = render();
    const button = html.match(/<button[^>]*aria-controls="mobile-nav"[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-expanded="false"');
    // No aria-label: the visible "Menu" text is the accessible name.
    expect(button).not.toContain("aria-label");
    expect(html).not.toContain("Toggle Navigation");
    expect(html).toContain(">Menu<");
  });

  it("labels the navigation landmark and the language group", () => {
    const html = render();
    expect(html).toContain('<nav aria-label="Main navigation"');
    expect(html).toContain('role="group" aria-label="Language"');
  });

  it("marks the current page and current language", () => {
    const html = render();
    // usePathname() is mocked to "/about".
    expect(html).toMatch(/<a href="\/about"[^>]*aria-current="page"/);
    expect(html).toMatch(/<a href="\/en\/about"[^>]*aria-current="true"/);
    expect(html).not.toMatch(/<a href="\/id\/about"[^>]*aria-current/);
  });

  it("gives each language link its own language and an autonym label", () => {
    const html = render();
    expect(html).toMatch(/<a href="\/id\/about"[^>]*lang="id"/);
    expect(html).toContain('aria-label="Bahasa Indonesia (ID)"');
    expect(html).toContain('aria-label="English (EN)"');
    // The old English-only label must be gone.
    expect(html).not.toContain("Switch language to");
  });
});
