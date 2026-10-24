// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

import { PasswordInput } from "./password-input";

// Tells React 19 this is an act() environment (silences its warning).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PasswordInput", () => {
  it("hides the password by default and reveals it when the toggle is pressed", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<PasswordInput defaultValue="hunter2" />));

    const input = host.querySelector("input")!;
    const toggle = host.querySelector("button")!;
    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("showPassword");

    act(() => toggle.click());
    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("hidePassword");

    act(() => root.unmount());
    host.remove();
  });

  it("never submits the form when the toggle is pressed", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<PasswordInput />));
    expect(host.querySelector("button")!.type).toBe("button");
    act(() => root.unmount());
    host.remove();
  });
});
