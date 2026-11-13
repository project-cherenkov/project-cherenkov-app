// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";

// Real English messages, so the assertions read the strings a reader sees.
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: (namespace: string) => actual.createTranslator({ locale: "en", messages: en, namespace }),
  };
});

import { TrajectorySandbox, judgeAttempt } from "./index";
import { handleCentre, HANDLE_SIZE_PX, launchOrigin } from "./launch-handle";
import type { TrajectorySandboxConfig } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// --- jsdom shims -----------------------------------------------------------
let rafQueue = new Map<number, FrameRequestCallback>();
let rafId = 0;

function flushFrame(now: number) {
  const callbacks = [...rafQueue.values()];
  rafQueue = new Map();
  act(() => callbacks.forEach((cb) => cb(now)));
}

// Runs playback to the end of the flight (g = 9.8, 20 m/s at 45° flies ~2.9 s).
function playToEnd() {
  let now = 1000;
  for (let i = 0; i < 80; i++) {
    flushFrame(now);
    now += 250;
  }
}

class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    this.cb([{ contentRect: { width: 400 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  rafQueue = new Map();
  rafId = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafId += 1;
    rafQueue.set(rafId, cb);
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue.delete(id);
  });
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  HTMLCanvasElement.prototype.getContext = (() => null) as never; // no canvas in jsdom: drawing is skipped
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const BASE: TrajectorySandboxConfig = {
  physicsType: "projectile",
  gravity: 9.8,
  initial: { speed: 20, angleDeg: 45 },
};

function mount(config: TrajectorySandboxConfig) {
  act(() => root.render(<TrajectorySandbox config={config} />));
}

const handle = () => container.querySelector<HTMLElement>('[data-testid="trajectory-angle-handle"]')!;
const byLabel = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
const angleThumb = () => container.querySelector<HTMLElement>(`[role="slider"][aria-label="${en.viz.trajectoryAngleName}"]`)!;
const speedThumb = () => container.querySelector<HTMLElement>(`[role="slider"][aria-label="${en.viz.trajectorySpeedName}"]`)!;
const text = () => container.textContent ?? "";

function press(el: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
}

function pointer(el: HTMLElement, type: string, clientX: number, clientY: number) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX, clientY, pointerId: 1 }));
  });
}

function click(label: string) {
  act(() => byLabel(label).click());
}

// Screen position (container is at 0,0 in jsdom) of a point `distance` px from
// the launch origin along `angleDeg`.
function pointAt(angleDeg: number, distance = 60) {
  const o = launchOrigin();
  const theta = (angleDeg * Math.PI) / 180;
  return { x: o.x + distance * Math.cos(theta), y: o.y - distance * Math.sin(theta) };
}

describe("TrajectorySandbox — draggable launch handle (R2)", () => {
  it("renders a keyboard-focusable slider handle with value bounds and a label", () => {
    mount(BASE);
    const h = handle();
    expect(h.getAttribute("role")).toBe("slider");
    expect(h.tabIndex).toBe(0);
    expect(h.getAttribute("aria-valuemin")).toBe("5");
    expect(h.getAttribute("aria-valuemax")).toBe("85");
    expect(h.getAttribute("aria-valuenow")).toBe("45");
    expect(h.getAttribute("aria-label")).toBe(en.viz.trajectoryHandleLabel);
  });

  it("uses a configured angleRange for its bounds", () => {
    mount({ ...BASE, angleRange: [10, 70] });
    expect(handle().getAttribute("aria-valuemin")).toBe("10");
    expect(handle().getAttribute("aria-valuemax")).toBe("70");
  });

  it("dragging the handle moves the angle slider with it", () => {
    mount(BASE);
    const p = pointAt(60);
    pointer(handle(), "pointerdown", p.x, p.y);
    expect(handle().getAttribute("aria-valuenow")).toBe("60");
    expect(angleThumb().getAttribute("aria-valuenow")).toBe("60");

    const q = pointAt(30);
    pointer(handle(), "pointermove", q.x, q.y);
    expect(handle().getAttribute("aria-valuenow")).toBe("30");
    expect(angleThumb().getAttribute("aria-valuenow")).toBe("30");
  });

  it("moving the angle slider moves the handle with it", () => {
    mount(BASE);
    press(angleThumb(), "ArrowRight");
    expect(angleThumb().getAttribute("aria-valuenow")).toBe("46");
    expect(handle().getAttribute("aria-valuenow")).toBe("46");
    const c = handleCentre(46);
    expect(handle().style.left).toBe(`${c.x - HANDLE_SIZE_PX / 2}px`);
    expect(handle().style.top).toBe(`${c.y - HANDLE_SIZE_PX / 2}px`);
  });

  it("never leaves the allowed range, however far the pointer goes", () => {
    mount(BASE);
    const up = pointAt(120);
    pointer(handle(), "pointerdown", up.x, up.y);
    expect(handle().getAttribute("aria-valuenow")).toBe("85");
    const down = { x: launchOrigin().x + 50, y: launchOrigin().y + 80 };
    pointer(handle(), "pointermove", down.x, down.y);
    expect(handle().getAttribute("aria-valuenow")).toBe("5");
  });

  it("ignores pointer movement when the pointer is not captured (no stray drags)", () => {
    mount(BASE);
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    const p = pointAt(70);
    pointer(handle(), "pointermove", p.x, p.y);
    expect(handle().getAttribute("aria-valuenow")).toBe("45");
  });

  it("the handle stays put when the drawing scale refits (changing speed does not move it)", () => {
    mount(BASE);
    const before = { left: handle().style.left, top: handle().style.top };
    for (let i = 0; i < 10; i++) press(speedThumb(), "ArrowRight");
    expect(speedThumb().getAttribute("aria-valuenow")).toBe("30");
    expect({ left: handle().style.left, top: handle().style.top }).toEqual(before);
  });

  it("arrow keys move 1°, Shift+arrow 5°, Home/End jump to the bounds, and clamp", () => {
    mount(BASE);
    press(handle(), "ArrowRight");
    expect(handle().getAttribute("aria-valuenow")).toBe("46");
    press(handle(), "ArrowUp");
    expect(handle().getAttribute("aria-valuenow")).toBe("47");
    press(handle(), "ArrowLeft");
    press(handle(), "ArrowDown");
    expect(handle().getAttribute("aria-valuenow")).toBe("45");
    press(handle(), "ArrowRight", { shiftKey: true });
    expect(handle().getAttribute("aria-valuenow")).toBe("50");
    press(handle(), "ArrowLeft", { shiftKey: true });
    press(handle(), "ArrowLeft", { shiftKey: true });
    expect(handle().getAttribute("aria-valuenow")).toBe("40");
    press(handle(), "End");
    expect(handle().getAttribute("aria-valuenow")).toBe("85");
    press(handle(), "ArrowRight", { shiftKey: true });
    expect(handle().getAttribute("aria-valuenow")).toBe("85");
    press(handle(), "Home");
    expect(handle().getAttribute("aria-valuenow")).toBe("5");
    press(handle(), "ArrowLeft", { shiftKey: true });
    expect(handle().getAttribute("aria-valuenow")).toBe("5");
  });

  it("opts only the handle out of touch scrolling, never the canvas", () => {
    mount(BASE);
    expect(handle().className).toContain("touch-none");
    const canvas = container.querySelector("canvas")!;
    expect(canvas.className).not.toContain("touch-none");
    // A press that starts on the canvas, outside the handle, changes nothing.
    const p = pointAt(70);
    pointer(canvas, "pointerdown", p.x, p.y);
    expect(handle().getAttribute("aria-valuenow")).toBe("45");
  });

  it("changing the angle (by drag) restarts the flight, like the slider does", () => {
    mount(BASE);
    click("Play");
    flushFrame(1000);
    flushFrame(1500);
    expect(byLabel("Pause")).toBeTruthy();
    const p = pointAt(50);
    pointer(handle(), "pointerdown", p.x, p.y);
    expect(byLabel("Play")).toBeTruthy();
    expect(text()).toContain("t = 0.00s");
  });
});

describe("judgeAttempt (R3)", () => {
  const target = { rangeM: 40, toleranceM: 2 };
  it("hits when |landing - target| <= tolerance, boundaries included", () => {
    expect(judgeAttempt(40, target).hit).toBe(true);
    expect(judgeAttempt(38, target).hit).toBe(true);
    expect(judgeAttempt(42, target).hit).toBe(true);
    expect(judgeAttempt(37.99, target).hit).toBe(false);
    expect(judgeAttempt(42.01, target).hit).toBe(false);
  });
  it("reports which side a miss fell on (positive = short)", () => {
    expect(judgeAttempt(30, target).shortByM).toBe(10);
    expect(judgeAttempt(50, target).shortByM).toBe(-10);
  });
});

describe("TrajectorySandbox — challenge (R3)", () => {
  // Launch 20 m/s at 45° lands ~40.8 m.
  const hitConfig: TrajectorySandboxConfig = {
    ...BASE,
    challenge: {
      prompt: "Land on the **marker**.",
      target: { rangeM: 40, toleranceM: 2 },
      successNote: "Well aimed: SUCCESS-NOTE.",
      hint: "HINT-TEXT",
    },
  };
  const missConfig: TrajectorySandboxConfig = {
    ...BASE,
    challenge: {
      prompt: "Land far away.",
      target: { rangeM: 100, toleranceM: 2 },
      hint: "HINT-TEXT",
      successNote: "SUCCESS-NOTE",
    },
  };

  it("a config without a challenge shows none of the challenge UI", () => {
    mount(BASE);
    expect(text()).not.toContain("Target:");
    expect(container.querySelector('[role="status"]:not(.label-mono)')).toBeNull();
  });

  it("shows the prompt and the target before any launch", () => {
    mount(hitConfig);
    expect(text()).toContain("Land on the");
    expect(text()).toContain("Target: land 40 m away, give or take 2 m.");
    expect(text()).not.toContain("On target");
  });

  it("success: a launch that lands within tolerance says so and shows the success note", () => {
    mount(hitConfig);
    click("Play");
    playToEnd();
    expect(text()).toContain("On target! You landed 40.8 m away.");
    expect(text()).toContain("SUCCESS-NOTE");
  });

  it("failure: a launch that lands short says how far short and invites another try", () => {
    mount(missConfig);
    click("Play");
    playToEnd();
    expect(text()).toContain("You landed 40.8 m away, 59.2 m short. Try again.");
    expect(text()).not.toContain("On target");
    expect(text()).not.toContain("SUCCESS-NOTE");
  });

  it("failure: a launch that lands long is reported as too far", () => {
    mount({
      ...BASE,
      initial: { speed: 30, angleDeg: 45 }, // lands ~91.8 m
      challenge: { prompt: "Not so far.", target: { rangeM: 40, toleranceM: 2 } },
    });
    click("Play");
    playToEnd();
    expect(text()).toMatch(/You landed 91\.8 m away, 51\.8 m too far\. Try again\./);
  });

  it("shows the hint only after two failed attempts, not before", () => {
    mount(missConfig);
    click("Play");
    playToEnd();
    expect(text()).not.toContain("HINT-TEXT"); // one miss

    click("Reset");
    click("Play");
    playToEnd();
    expect(text()).toContain("Hint");
    expect(text()).toContain("HINT-TEXT"); // two misses
  });

  it("pressing Play with the marker already parked at the landing is not a new attempt", () => {
    mount(missConfig);
    click("Play");
    playToEnd();
    click("Play"); // nothing launched: the marker is already at the end
    playToEnd();
    click("Play");
    playToEnd();
    expect(text()).not.toContain("HINT-TEXT");
  });

  it("scrubbing the marker to the end is not an attempt either", () => {
    mount(missConfig);
    click("Step forward");
    click("Step forward");
    expect(text()).not.toContain("You landed");
    expect(text()).not.toContain("HINT-TEXT");
  });

  it("a hint is not offered when the config has none", () => {
    mount({ ...missConfig, challenge: { ...missConfig.challenge!, hint: undefined } });
    for (let i = 0; i < 3; i++) {
      click("Reset");
      click("Play");
      playToEnd();
    }
    expect(text()).not.toContain("Hint");
  });

  it("changing the launch clears the previous verdict, and a later hit hides the hint", () => {
    mount(missConfig);
    for (let i = 0; i < 2; i++) {
      click("Reset");
      click("Play");
      playToEnd();
    }
    expect(text()).toContain("HINT-TEXT");

    // Speed 31 m/s at 45° lands ~98.1 m: within 2 m of 100.
    for (let i = 0; i < 11; i++) press(speedThumb(), "ArrowRight");
    expect(text()).not.toContain("Try again"); // old verdict cleared
    click("Play");
    playToEnd();
    expect(text()).toContain("On target! You landed 98.1 m away.");
    expect(text()).toContain("SUCCESS-NOTE");
    expect(text()).not.toContain("HINT-TEXT");
  });

  it("the verdict is announced politely to assistive tech", () => {
    mount(hitConfig);
    click("Play");
    playToEnd();
    const status = [...container.querySelectorAll('[role="status"]')].find((el) =>
      (el.textContent ?? "").includes("On target"),
    );
    expect(status).toBeTruthy();
  });
});
