// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// T1 (D1 = Option B). Sign-up still signs the person in and goes to the planner,
// but the verification link the server emails must land on the locale-prefixed
// confirmation page, so signUp.email has to be given that callbackURL.
const { push, signUpEmail } = vi.hoisted(() => ({
  push: vi.fn(),
  signUpEmail: vi.fn(async (_input: unknown): Promise<{ error: { code?: string; message?: string } | null }> => ({ error: null })),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/i18n/routing", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  usePathname: () => "/signup",
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({
  signUp: { email: signUpEmail },
  signIn: { social: vi.fn() },
}));

import { SignupForm } from "./signup-form";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  push.mockClear();
  signUpEmail.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function submit() {
  const form = container.querySelector("form") as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

describe("SignupForm", () => {
  it("asks for the verification link to land on the locale-prefixed confirmation page", async () => {
    act(() => root.render(<SignupForm googleEnabled={false} />));
    await submit();
    expect(signUpEmail).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: "/en/email-verified" }));
  });

  it("does not put a wall in front of a new account: it still goes to the planner", async () => {
    act(() => root.render(<SignupForm googleEnabled={false} />));
    await submit();
    expect(push).toHaveBeenCalledWith("/planner");
  });

  it("stays on the page and shows the translated message when sign-up fails", async () => {
    signUpEmail.mockResolvedValueOnce({ error: { code: "USER_ALREADY_EXISTS" } });
    act(() => root.render(<SignupForm googleEnabled={false} />));
    await submit();
    expect(push).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("USER_ALREADY_EXISTS");
  });
});
