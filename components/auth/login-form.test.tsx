// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// F-02 regression: components/auth/login-form.tsx used to inline
// `nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")` at
// both call sites (post-email-sign-in `router.push`, and the `callbackURL`
// passed to `signIn.social`), which accepts a backslash-based origin bypass
// like `/\evil.example`. Both now delegate to the shared, corrected
// `isSafeReturnTo` from lib/safe-redirect.ts (see that file's own tests for
// exhaustive coverage of the check itself). This file drives the real
// rendered form via actual DOM events (jsdom + react-dom/client), rather
// than reimplementing handleSubmit/handleGoogle's logic, so it fails
// honestly if either call site regresses. This is the only test file in
// the repo using the jsdom environment (rather than renderToStaticMarkup) —
// necessary here because both call sites only run inside event handlers,
// and one of them (handleSubmit) uses useTransition's startTransition,
// which throws if invoked under React's SSR dispatcher.
const { searchParams, push, signInEmail, signInSocial } = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  push: vi.fn(),
  signInEmail: vi.fn(async () => ({ error: null })),
  signInSocial: vi.fn(async () => ({ error: null })),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "id",
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  usePathname: () => "/login",
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  signIn: { email: signInEmail, social: signInSocial },
}));

import { LoginForm } from "./login-form";

// Silences React's "environment not configured for act()" warning; jsdom
// itself works fine here, this global is just how React 19 detects it.
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
  signInEmail.mockClear();
  signInSocial.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function setNextParam(value: string | null) {
  searchParams.delete("next");
  if (value !== null) searchParams.set("next", value);
}

describe("LoginForm — safe-redirect handling (F-02)", () => {
  it("falls back to /planner on submit when ?next is a backslash-based origin bypass", async () => {
    setNextParam("/\\evil.example");
    act(() => {
      root.render(<LoginForm googleEnabled />);
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(signInEmail).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/planner");
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining("evil.example"));
  });

  it("passes a same-locale fallback callbackURL to signIn.social when ?next is the same bypass", async () => {
    setNextParam("/\\evil.example");
    act(() => {
      root.render(<LoginForm googleEnabled />);
    });

    const googleButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("googleButton"),
    ) as HTMLButtonElement;
    expect(googleButton).toBeTruthy();

    await act(async () => {
      googleButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google", callbackURL: "/id/planner" }),
    );
  });

  it("still honors a genuinely safe ?next value", async () => {
    setNextParam("/quiz");
    act(() => {
      root.render(<LoginForm googleEnabled />);
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(push).toHaveBeenCalledWith("/quiz");
  });
});
