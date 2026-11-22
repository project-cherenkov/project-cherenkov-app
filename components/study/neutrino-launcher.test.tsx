// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en";

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
  usePathname: () => "/",
}));
vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: session.current }) }));
vi.mock("@/components/study/study-timer", () => ({ StudyTimer: () => <div>timer</div> }));
vi.mock("@/components/study/manifold-mascot", () => ({ ManifoldMascot: () => <span data-testid="mascot" /> }));

import { InPageNeutrino } from "./neutrino-launcher";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", FakeResizeObserver);

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

describe("style", () => {
  it("is pixel by default: scoped class, status readout, no original subtitle", async () => {
    await openPanel();
    const root = panel()!.querySelector(".nt-panel")!;
    expect(root.classList.contains("nt-pixel")).toBe(true);
    expect(root.getAttribute("data-style")).toBe("pixel");
    expect(panel()!.querySelector('[role="status"]')!.textContent).toContain("mode: FAQ");
    expect(panel()!.textContent).not.toContain("FAQ · pre-written answers");
  });

  it("smooth renders as it did before: no pixel class, original subtitle, no glyph", async () => {
    window.localStorage.setItem("neutrino-prefs-v1", JSON.stringify({ style: "smooth" }));
    await openPanel();
    const root = panel()!.querySelector(".nt-panel")!;
    expect(root.classList.contains("nt-pixel")).toBe(false);
    expect(panel()!.closest("section")!.querySelector(".nt-shell, .nt-unfold")).toBeNull();
    expect(panel()!.textContent).toContain("FAQ · pre-written answers");
    expect(document.querySelector("[data-glyph]")).toBeNull();
  });

  it("pixel: every panel icon is a pixel icon, none is lucide, and the skin is scoped to the panel", async () => {
    await openPanel();
    const p = panel()!;
    expect(p.querySelectorAll('svg[data-nt-icon="pixel"]').length).toBeGreaterThan(3);
    expect(p.querySelectorAll("svg.lucide").length).toBe(0);
    for (const svg of p.querySelectorAll('svg[data-nt-icon="pixel"]')) {
      expect(svg.getAttribute("width")).toBe("24");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
    expect(p.querySelector(".nt-frame")!.closest(".nt-pixel")).not.toBeNull();
  });

  it("smooth: the original lucide icons, no pixel icons, and nothing under a .nt-pixel scope", async () => {
    window.localStorage.setItem("neutrino-prefs-v1", JSON.stringify({ style: "smooth" }));
    await openPanel();
    const p = panel()!;
    expect(p.querySelectorAll("svg.lucide").length).toBeGreaterThan(3);
    expect(p.querySelectorAll('svg[data-nt-icon="pixel"]').length).toBe(0);
    expect(p.querySelectorAll(".nt-pixel").length).toBe(0);
    expect(p.closest(".nt-pixel")).toBeNull();
  });

  it("marks FAQ and chat text as exempt from the pixel face", async () => {
    await openPanel();
    const exempt = panel()!.querySelectorAll("[data-nt-exempt]");
    expect(exempt.length).toBeGreaterThan(0);
    for (const el of exempt) expect(el.className).not.toContain("nt-font");
  });
});

describe("answer mode", () => {
  it("opens in the FAQ and says so", async () => {
    await openPanel();
    const faq = byText("FAQ")!;
    const ai = byText("AI chat")!;
    expect(faq.getAttribute("aria-pressed")).toBe("true");
    expect(ai.getAttribute("aria-pressed")).toBe("false");
    expect(panel()!.textContent).toContain("You are using the FAQ");
    expect(panel()!.textContent).toContain("mode: FAQ · sends nothing");
    expect(panel()!.querySelector("textarea")).toBeNull();
  });

  it("switches to AI chat, says so, and asks a signed-out student to sign in", async () => {
    await openPanel();
    act(() => byText("AI chat")!.click());
    expect(panel()!.textContent).toContain("Before using AI chat");
    const notice = panel()!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    act(() => notice.click());
    await act(async () => {
      byText("Confirm and continue")!.click();
      await Promise.resolve();
    });
    expect(byText("AI chat")!.getAttribute("aria-pressed")).toBe("true");
    expect(panel()!.textContent).toContain("You are using AI chat");
    expect(panel()!.textContent).toContain("sent to Google");
    expect(panel()!.textContent).toContain("Sign in to use AI chat");
    expect(panel()!.textContent).toContain("mode: AI · text leaves your device");
    expect(JSON.parse(window.localStorage.getItem("neutrino-prefs-v1")!).aiAcknowledged).toBe(true);
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

  it("allows dismissing the FAQ notice with a cross and persists the choice", async () => {
    await openPanel();
    expect(panel()!.textContent).toContain("You are using the FAQ");
    const dismissBtn = panel()!.querySelector<HTMLButtonElement>('button[aria-label="Dismiss FAQ notice"]')!;
    expect(dismissBtn).toBeTruthy();
    await act(async () => {
      dismissBtn.click();
    });
    expect(panel()!.textContent).not.toContain("You are using the FAQ");
    expect(JSON.parse(window.localStorage.getItem("neutrino-prefs-v1")!).faqBannerDismissed).toBe(true);
  });

  it("allows dismissing the AI chat notice with a cross and persists the choice", async () => {
    window.localStorage.setItem("neutrino-prefs-v1", JSON.stringify({ aiAcknowledged: true }));
    await openPanel();
    act(() => byText("AI chat")!.click());
    expect(panel()!.textContent).toContain("You are using AI chat");
    const dismissBtn = panel()!.querySelector<HTMLButtonElement>('button[aria-label="Dismiss AI notice"]')!;
    expect(dismissBtn).toBeTruthy();
    await act(async () => {
      dismissBtn.click();
    });
    expect(panel()!.textContent).not.toContain("You are using AI chat");
    expect(JSON.parse(window.localStorage.getItem("neutrino-prefs-v1")!).aiBannerDismissed).toBe(true);
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

describe("the mascot dock", () => {
  const dockWrapper = () => document.querySelector<HTMLElement>(".neutrino-dock")!;
  const dockButton = () => document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
  // jsdom has no layout, so say where the mascot is on screen: somewhere away
  // from its resting corner, as it is after it has wandered off.
  function placeAt(button: HTMLElement, left: number, top: number) {
    button.getBoundingClientRect = () => ({ left, top, right: left + 76, bottom: top + 76, width: 76, height: 76, x: left, y: top, toJSON() {} }) as DOMRect;
  }

  it("does not enter drag mode, or move, on a plain press and release", async () => {
    await act(async () => root.render(<InPageNeutrino />));
    const restingLeft = dockWrapper().style.left;
    placeAt(dockButton(), 300, 200);
    pointer(dockButton(), "pointerdown", 310, 210);
    // Entering drag mode here is what used to swap the dock from where it was
    // on screen to its resting corner when the pointer was released.
    expect(dockWrapper().dataset.dragging).toBe("false");
    expect(dockWrapper().style.left).toBe(restingLeft);
    pointer(dockButton(), "pointerup", 310, 210);
    expect(dockWrapper().dataset.dragging).toBe("false");
    expect(dockWrapper().style.left).toBe(restingLeft);
    expect(window.localStorage.getItem("neutrino-position-v1")).toBeNull();
  });

  it("starts dragging only after the pointer has travelled, from where the mascot was on screen", async () => {
    await act(async () => root.render(<InPageNeutrino />));
    placeAt(dockButton(), 300, 200);
    pointer(dockButton(), "pointerdown", 310, 210);
    pointer(dockButton(), "pointermove", 313, 210); // under the 6px threshold
    expect(dockWrapper().dataset.dragging).toBe("false");
    pointer(dockButton(), "pointermove", 410, 260);
    expect(dockWrapper().dataset.dragging).toBe("true");
    expect(dockWrapper().style.left).toBe("400px");
    expect(dockWrapper().style.top).toBe("250px");
    pointer(dockButton(), "pointerup", 410, 260);
    expect(dockWrapper().dataset.dragging).toBe("false");
    expect(window.localStorage.getItem("neutrino-position-v1")).not.toBeNull();
    expect(panel()).toBeNull(); // the click that follows a drag is ignored
  });

  async function startDrag() {
    await act(async () => root.render(<InPageNeutrino />));
    placeAt(dockButton(), 300, 200);
    pointer(dockButton(), "pointerdown", 310, 210);
    pointer(dockButton(), "pointermove", 410, 260);
    expect(dockWrapper().dataset.dragging).toBe("true");
  }

  it("cancels every wander animation the moment a drag begins", async () => {
    await act(async () => root.render(<InPageNeutrino />));
    const cancel = vi.fn();
    // Two legs still attached: the newest and an older fill:forwards one.
    dockWrapper().getAnimations = (() => [{ cancel }, { cancel }]) as never;
    placeAt(dockButton(), 300, 200);
    pointer(dockButton(), "pointerdown", 310, 210);
    expect(cancel).not.toHaveBeenCalled(); // a plain press leaves the wander alone
    pointer(dockButton(), "pointermove", 410, 260);
    expect(cancel.mock.calls.length).toBeGreaterThanOrEqual(2); // by the move itself, then again by the hook
  });

  for (const how of ["pointercancel", "lostpointercapture"]) {
    it(`keeps the last position and clears the drag when it ends with ${how}`, async () => {
      await startDrag();
      pointer(dockButton(), how, 410, 260);
      expect(dockWrapper().dataset.dragging).toBe("false");
      expect(JSON.parse(window.localStorage.getItem("neutrino-position-v1")!)).toBeTruthy();
      expect(dockWrapper().style.left).not.toBe("");
    });
  }

  it("ends an open drag when the window loses focus", async () => {
    await startDrag();
    act(() => { window.dispatchEvent(new Event("blur")); });
    expect(dockWrapper().dataset.dragging).toBe("false");
    expect(window.localStorage.getItem("neutrino-position-v1")).not.toBeNull();
  });

  it("ends an open drag when the tab is hidden", async () => {
    await startDrag();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect(dockWrapper().dataset.dragging).toBe("false");
  });

  it("lets a new drag start after one was ended by a blur", async () => {
    await startDrag();
    act(() => { window.dispatchEvent(new Event("blur")); });
    pointer(dockButton(), "pointerdown", 410, 260);
    pointer(dockButton(), "pointermove", 480, 300);
    expect(dockWrapper().dataset.dragging).toBe("true");
  });

  it("makes the dock ignore touch gestures on the button itself", async () => {
    await act(async () => root.render(<InPageNeutrino />));
    expect(dockButton().className.split(/\s+/)).toContain("touch-none");
  });

  it("gives the hide button no click target over the mascot until it is shown", async () => {
    await act(async () => root.render(<InPageNeutrino />));
    const hide = document.querySelector<HTMLButtonElement>(`button[aria-label="${en.companion.hideNow}"]`)!;
    expect(hide).toBeTruthy();
    const classes = hide.className.split(/\s+/);
    // Invisible means unclickable: a tap on the upper right of the mascot used to hit this.
    expect(classes).toContain("pointer-events-none");
    for (const shown of ["group-hover", "group-focus-within", "focus-visible"]) {
      expect(classes).toContain(`${shown}:pointer-events-auto`);
      expect(classes).toContain(`${shown}:opacity-100`);
    }
    // Sits on the corner of the mascot, and its enlarged target grows outwards only.
    expect(classes).toContain("-right-3");
    expect(classes).toContain("-top-3");
    expect(classes).not.toContain("before:-inset-2.5");
    // Touch-only devices get no hide button; Settings has the 44px one.
    expect(classes).toContain("[@media(hover:none)]:hidden");
  });
});

describe("resize handles", () => {
  it("do not store a panel size when they are only clicked", async () => {
    await openPanel();
    const handle = separator("Panel width")!;
    pointer(handle, "pointerdown", 700, 300);
    pointer(handle, "pointerup", 700, 300);
    expect(window.localStorage.getItem("neutrino-panel-size-v1")).toBeNull();
  });
});

describe("switching tabs", () => {
  it("keeps the FAQ conversation when going to Settings and back", async () => {
    await openPanel();
    act(() => byText(en.companion.faq.items["what-is"].q)!.click());
    const answer = en.companion.faq.items["what-is"].a.slice(0, 40);
    expect(panel()!.textContent).toContain(answer);
    act(() => byText("Settings")!.click());
    act(() => byText("Ask")!.click());
    expect(panel()!.textContent).toContain(answer);
  });
});

describe("the intro bubble", () => {
  const realRect = Element.prototype.getBoundingClientRect;
  // Where the mascot is on screen, e.g. after it has wandered away from its
  // resting corner (jsdom has no layout, so say it).
  function mascotAt(left: number) {
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.matches('button[aria-haspopup="dialog"]')) {
        return { left, right: left + 76, top: 300, bottom: 376, width: 76, height: 76, x: left, y: 300, toJSON() {} } as DOMRect;
      }
      return realRect.call(this);
    };
  }
  afterEach(() => { Element.prototype.getBoundingClientRect = realRect; });
  const bubbleBox = () => byText(en.companion.introPrompt)!.parentElement!;

  it("sits to the mascot's left when there is room on that side", async () => {
    mascotAt(900);
    await act(async () => root.render(<InPageNeutrino />));
    expect(bubbleBox().className).toContain("right-full");
    expect(bubbleBox().className).not.toContain("left-full");
  });

  it("moves to the mascot's right when it has wandered to the left edge", async () => {
    // Its resting spot is still the bottom-right corner; only where it is on
    // screen has changed, and the bubble used to follow the resting spot.
    mascotAt(10);
    await act(async () => root.render(<InPageNeutrino />));
    expect(bubbleBox().className).toContain("left-full");
    expect(bubbleBox().className).not.toContain("right-full");
  });
});
