import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockUseSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  useSession: () => mockUseSession(),
  signOut: () => mockSignOut(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      archive: "Archive",
      about: "About",
      repo: "GitHub",
      edit: "Edit",
      login: "Log In",
      signup: "Sign Up",
      myPlan: "My Plan",
      logout: "Log Out",
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
    expect(html).toContain("GitHub");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Log In");
    expect(html).toContain('href="/signup"');
    expect(html).toContain("Sign Up");
    expect(html).not.toContain("My Plan");
    expect(html).not.toContain("Log Out");
  });

  it("renders Edit link, My Plan and Log Out when logged in", () => {
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
    expect(html).toContain("Log Out");
    expect(html).not.toContain("Log In");
    expect(html).not.toContain("Sign Up");
  });
});
