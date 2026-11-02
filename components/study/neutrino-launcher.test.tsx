// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";

// Drives the whole companion (mascot, panel, mode switch, resize handles)
// through real DOM events with the real English messages.
const { session } = vi.hoisted(() => ({ session: { current: null as unknown } }));

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: (namespace: string) => actual.createTranslator({ locale: "en", messages: en, namespace }),
  };
});
vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: session.current }) }));
vi.mock("@/components/study/study-timer", () => ({ StudyTimer: () => <div>timer</div> }));
vi.mock("@/components/study/manifold-mascot", () => ({ ManifoldMascot: () => <span data-testid="mascot" /> }));

import { InPageNeutrino } from "./neutrino-launcher";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  session.current = null;
  Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollTo = vi.fn() as never;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const buttons = () => [...document.querySelectorAll("button")];
const byText = (text: string) => buttons().find((button) => button.textContent?.trim() === text);
const panel = () => document.querySelector<HTMLElement>('[role="dialog"]');
const separator = (label: string) => document.querySelector<HTMLElement>(`[role="separator"][aria-label="${label}"]`);

async function openPanel() {
  await act(async () => root.render(<InPageNeutrino />));
  act(() => document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
}
function key(el: Element, k: string, shiftKey = false) {
  act(() => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true, cancelable: true })); });
}
function pointer(el: Element, type: string, x: number, y: number) {
  act(() => { el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0 })); });
}

describe("answer mode", () => {
  it("opens in the FAQ and says so", async () => {
    await openPanel();
    const faq = byText("FAQ")!;
    const ai = byText("AI chat")!;
    expect(faq.getAttribute("aria-pressed")).toBe("true");
    expect(ai.getAttribute("aria-pressed")).toBe("false");
    expect(panel()!.textContent).toContain("You are using the FAQ");
    expect(panel()!.textContent).toContain("FAQ · pre-written answers");
    expect(panel()!.querySelector("textarea")).toBeNull();
  });

  it("switches to AI chat, says so, and asks a signed-out student to sign in", async () => {
    await openPanel();
    act(() => byText("AI chat")!.click());
    expect(byText("AI chat")!.getAttribute("aria-pressed")).toBe("true");
    expect(panel()!.textContent).toContain("You are using AI chat");
    expect(panel()!.textContent).toContain("sent to Google");
    expect(panel()!.textContent).toContain("Sign in to use AI chat");
    expect(panel()!.textContent).toContain("AI chat · generated replies");
    act(() => byText("FAQ")!.click());
    expect(panel()!.textContent).toContain("You are using the FAQ");
  });

  it("offers no AI at all when it is switched off, and points to Settings", async () => {
    window.localStorage.setItem("neutrino-prefs-v1", JSON.stringify({ aiEnabled: false }));
    await openPanel();
    expect(byText("AI chat")).toBeUndefined();
    expect(panel()!.textContent).toContain("AI chat is turned off, so only the FAQ is available");
    expect(panel()!.querySelector("textarea")).toBeNull();
    act(() => byText("Turn it on in Settings")!.click());
    const toggle = panel()!.querySelector<HTMLInputElement>('input[role="switch"]')!;
    expect(toggle.checked).toBe(false);
    await act(async () => toggle.click());
    expect(JSON.parse(window.localStorage.getItem("neutrino-prefs-v1")!).aiEnabled).toBe(true);
  });

  it("returns to the FAQ when the AI is switched off while AI chat is showing", async () => {
    await openPanel();
    act(() => byText("AI chat")!.click());
    act(() => byText("Settings")!.click());
    await act(async () => panel()!.querySelector<HTMLInputElement>('input[role="switch"]')!.click());
    act(() => byText("Ask")!.click());
    expect(byText("AI chat")).toBeUndefined();
    expect(panel()!.textContent).toContain("You are using the FAQ");
  });
});

describe("resizing the panel", () => {
  it("offers handles on the edges that face away from a mascot in the bottom-right corner", async () => {
    await openPanel();
    expect(separator("Panel width")).toBeTruthy();
    expect(separator("Panel height")).toBeTruthy();
    expect(separator("Panel width")!.className).toContain("-left-3");
    expect(separator("Panel height")!.className).toContain("-top-3");
  });

  it("resizes from the keyboard, remembers the size, and resets it", async () => {
    await openPanel();
    const width = separator("Panel width")!;
    const before = Number(width.getAttribute("aria-valuenow"));
    key(width, "ArrowLeft");
    expect(Number(separator("Panel width")!.getAttribute("aria-valuenow"))).toBe(before + 24);
    key(separator("Panel width")!, "ArrowLeft", true);
    expect(Number(separator("Panel width")!.getAttribute("aria-valuenow"))).toBe(before + 24 + 96);
    expect(JSON.parse(window.localStorage.getItem("neutrino-panel-size-v1")!).width).toBe(before + 120);
    expect(panel()!.style.width).toBe(`${before + 120}px`);

    key(separator("Panel height")!, "ArrowUp");
    expect(window.localStorage.getItem("neutrino-panel-size-v1")).toContain("height");

    act(() => { separator("Panel width")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); });
    expect(window.localStorage.getItem("neutrino-panel-size-v1")).toBeNull();
    expect(panel()!.style.width).toBe("384px");
  });

  it("resizes by dragging and keeps the edge facing the mascot where it was", async () => {
    await openPanel();
    const section = panel()!;
    const right = parseFloat(section.style.left) + parseFloat(section.style.width);
    const bottom = parseFloat(section.style.top) + parseFloat(section.style.height);
    const corner = section.querySelector<HTMLElement>('div[aria-hidden="true"]')!;
    pointer(corner, "pointerdown", 700, 150);
    pointer(corner, "pointermove", 640, 120);
    expect(parseFloat(section.style.width)).toBe(384 + 60);
    pointer(corner, "pointerup", 640, 120);

    const after = panel()!;
    expect(parseFloat(after.style.left) + parseFloat(after.style.width)).toBeCloseTo(right);
    expect(parseFloat(after.style.top) + parseFloat(after.style.height)).toBeCloseTo(bottom);
    expect(parseFloat(after.style.width)).toBe(444);
    expect(JSON.parse(window.localStorage.getItem("neutrino-panel-size-v1")!).width).toBe(444);
  });

  it("restores a saved size when the page loads again", async () => {
    window.localStorage.setItem("neutrino-panel-size-v1", JSON.stringify({ width: 500, height: 420 }));
    await openPanel();
    expect(panel()!.style.width).toBe("500px");
    expect(panel()!.style.height).toBe("420px");
  });

  it("has a reset button in Settings", async () => {
    window.localStorage.setItem("neutrino-panel-size-v1", JSON.stringify({ width: 500, height: 420 }));
    await openPanel();
    act(() => byText("Settings")!.click());
    act(() => byText("Reset panel size")!.click());
    expect(panel()!.style.width).toBe("384px");
    expect(window.localStorage.getItem("neutrino-panel-size-v1")).toBeNull();
  });
});
