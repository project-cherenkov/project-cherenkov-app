// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { deleteUser } = vi.hoisted(() => ({
  deleteUser: vi.fn(async (_input: unknown): Promise<{ error: { code?: string; message?: string } | null }> => ({ error: null })),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { deleteUser } }));

import { DeleteAccount } from "./delete-account";

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
  deleteUser.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const buttons = () => Array.from(container.querySelectorAll("button"));
async function open() {
  await act(async () => {
    buttons()[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}
async function submit() {
  await act(async () => {
    (container.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

describe("DeleteAccount", () => {
  it("does nothing until the person opens the confirmation step", () => {
    act(() => root.render(<DeleteAccount email="a@b.c" hasPassword />));
    expect(deleteUser).not.toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
  });

  it("asks for a confirmation email, sending the password for a password account and the locale-prefixed landing page", async () => {
    act(() => root.render(<DeleteAccount email="a@b.c" hasPassword />));
    await open();
    const input = container.querySelector("input[type=password], input") as HTMLInputElement;
    expect(input).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "correct horse");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await submit();
    expect(deleteUser).toHaveBeenCalledWith({ password: "correct horse", callbackURL: "/en/account-deleted" });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("sent");
  });

  it("sends no password for a Google-only account (the emailed link is the confirmation)", async () => {
    act(() => root.render(<DeleteAccount email="a@b.c" hasPassword={false} />));
    await open();
    expect(container.querySelector("input")).toBeNull();
    await submit();
    expect(deleteUser).toHaveBeenCalledWith({ callbackURL: "/en/account-deleted" });
  });

  it("keeps the form and shows an error when the request fails", async () => {
    deleteUser.mockResolvedValueOnce({ error: { code: "INVALID_PASSWORD", message: "Invalid password" } });
    act(() => root.render(<DeleteAccount email="a@b.c" hasPassword={false} />));
    await open();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Invalid password");
    expect(container.querySelector("form")).not.toBeNull();
  });
});
