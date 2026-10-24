import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  usePathname: () => "/login",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({ signIn: { email: vi.fn(), social: vi.fn() } }));

import { LoginForm } from "./login-form";

describe("LoginForm password reset link (U10)", () => {
  it("is hidden when the deployment cannot send email", () => {
    const html = renderToStaticMarkup(<LoginForm googleEnabled={false} />);
    expect(html).not.toContain("/forgot-password");
  });

  it("is shown when reset is enabled", () => {
    const html = renderToStaticMarkup(<LoginForm googleEnabled={false} resetEnabled />);
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain("forgotLink");
  });

  it("offers a show/hide password toggle", () => {
    const html = renderToStaticMarkup(<LoginForm googleEnabled={false} />);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("showPassword");
  });
});
