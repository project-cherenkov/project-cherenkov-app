// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendVerificationEmail } = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(async (_input: unknown): Promise<{ error: { code?: string; status?: number } | null }> => ({ error: null })),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "id",
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { sendVerificationEmail } }));

import { EmailVerification } from "./email-verification";

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
  sendVerificationEmail.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = () => container.querySelector("button") as HTMLButtonElement | null;
async function click() {
  await act(async () => {
    button()!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

describe("EmailVerification", () => {
  it("shows a verified address with no action", () => {
    act(() => root.render(<EmailVerification email="a@b.c" verified />));
    expect(container.textContent).toBe("verified");
    expect(button()).toBeNull();
  });

  it("offers to resend for an unverified address and asks for the locale-prefixed landing page", async () => {
    act(() => root.render(<EmailVerification email="a@b.c" verified={false} />));
    expect(container.textContent).toContain("unverified");
    await click();
    expect(sendVerificationEmail).toHaveBeenCalledWith({ email: "a@b.c", callbackURL: "/id/email-verified" });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("sent");
    expect(button()).toBeNull();
  });

  it("shows the mapped message for a known error code and keeps the button", async () => {
    sendVerificationEmail.mockResolvedValueOnce({ error: { code: "EMAIL_ALREADY_VERIFIED" } });
    act(() => root.render(<EmailVerification email="a@b.c" verified={false} />));
    await click();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("EMAIL_ALREADY_VERIFIED");
    expect(button()).not.toBeNull();
  });

  it("shows the rate-limit message on HTTP 429", async () => {
    sendVerificationEmail.mockResolvedValueOnce({ error: { status: 429 } });
    act(() => root.render(<EmailVerification email="a@b.c" verified={false} />));
    await click();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("rateLimited");
  });
});
