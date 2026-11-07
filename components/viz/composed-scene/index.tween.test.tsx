// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: (namespace: string) => actual.createTranslator({ locale: "en", messages: en, namespace }),
  };
});

import { ComposedScene } from "./index";
import type { ComposedSceneConfig } from "./types";

// R1 (docs/viz-interaction-improvements.md): the stateful part of the glide —
// when it runs, when it snaps, and that it never skips a step.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// One circle whose x is 40 in base params, 140 at step 1 and 240 at step 2.
const CONFIG: ComposedSceneConfig = {
  canvas: { widthPx: 400, heightPx: 200 },
  elements: [{ id: "ball", templateId: "shape-circle", params: { x: 40, y: 60, radius: 10, color: "blue" } }],
  steps: [
    { note: "Zero", overrides: {} },
    { note: "One", overrides: { ball: { x: 140 } } },
    { note: "Two", overrides: { ball: { x: 240 } } },
  ],
};

let rafQueue = new Map<number, FrameRequestCallback>();
let rafId = 0;
let arcX: number[] = []; // x of every circle drawn, in draw order
let reducedMotion = false;

function flushFrame(now: number) {
  const callbacks = [...rafQueue.values()];
  rafQueue = new Map();
  act(() => callbacks.forEach((cb) => cb(now)));
}

const lastX = () => arcX[arcX.length - 1];

class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    // 400 px wide == canvas.widthPx, so design space equals pixel space.
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
  arcX = [];
  reducedMotion = false;
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafId += 1;
    rafQueue.set(rafId, cb);
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue.delete(id);
  });
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLCanvasElement.prototype.getContext = (() =>
    new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "arc") return (x: number) => void arcX.push(x);
          return () => undefined;
        },
        set: () => true,
      },
    )) as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mount(config = CONFIG) {
  act(() => root.render(<ComposedScene config={config} />));
}
const button = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
const click = (label: string) => act(() => button(label).click());

describe("ComposedScene — gliding between steps (R1)", () => {
  it("draws step 0 at rest", () => {
    mount();
    expect(lastX()).toBe(40);
  });

  it("stepping forward by one glides from the old value to the new one, then settles exactly", () => {
    mount();
    click("Step forward");
    expect(lastX()).toBe(40); // starts where it was: no snap to the new step first

    flushFrame(1000); // frame 1 fixes the start time
    flushFrame(1200); // halfway through the 400 ms glide
    expect(lastX()).toBeGreaterThan(40);
    expect(lastX()).toBeLessThan(140);
    expect(lastX()).toBeCloseTo(90, 5); // smoothstep(0.5) is exactly 0.5

    flushFrame(1400); // done
    expect(lastX()).toBe(140);
    flushFrame(1600);
    expect(lastX()).toBe(140);
    expect(rafQueue.size).toBe(0); // no animation loop left running
  });

  it("the step note follows the target step immediately while the picture glides", () => {
    mount();
    expect(container.textContent).toContain("Zero");
    click("Step forward");
    expect(container.textContent).toContain("One");
    expect(lastX()).toBe(40);
  });

  it("stepping backward glides too", () => {
    mount();
    click("Step forward");
    flushFrame(1000);
    flushFrame(1400);
    expect(lastX()).toBe(140);
    click("Step back");
    flushFrame(2000);
    flushFrame(2200);
    expect(lastX()).toBeCloseTo(90, 5);
    flushFrame(2400);
    expect(lastX()).toBe(40);
  });

  it("an interrupted glide restarts from what is on screen, not from the step that was heading away", () => {
    mount();
    click("Step forward");
    flushFrame(1000);
    flushFrame(1200);
    expect(lastX()).toBeCloseTo(90, 5); // halfway to step 1

    click("Step forward"); // heading to step 2 now
    expect(lastX()).toBeCloseTo(90, 5); // continues from 90 — no jump back to 40 or ahead to 140
    flushFrame(3000);
    flushFrame(3200);
    expect(lastX()).toBeCloseTo(165, 5); // halfway between 90 and 240
    flushFrame(3400);
    expect(lastX()).toBe(240);
  });

  it("Reset snaps instead of gliding", () => {
    mount();
    click("Step forward");
    flushFrame(1000);
    flushFrame(1400);
    expect(lastX()).toBe(140);
    click("Reset");
    expect(lastX()).toBe(40);
    expect(rafQueue.size).toBe(0);
  });

  it("with prefers-reduced-motion the step change snaps", () => {
    reducedMotion = true;
    mount();
    click("Step forward");
    expect(lastX()).toBe(140);
    expect(rafQueue.size).toBe(0);
  });

  it("a new config snaps to its first step and cancels any glide", () => {
    mount();
    click("Step forward");
    flushFrame(1000);
    flushFrame(1200);
    const other: ComposedSceneConfig = {
      ...CONFIG,
      elements: [{ id: "ball", templateId: "shape-circle", params: { x: 300, y: 60, radius: 10, color: "blue" } }],
    };
    mount(other);
    expect(lastX()).toBe(300);
    flushFrame(1400);
    flushFrame(1600);
    expect(lastX()).toBe(300);
  });

  it("autoplay still advances one step per tick, never skipping a step, and ends on the last step", () => {
    mount();
    click("Play");
    const notes: string[] = [];
    const note = () => (container.textContent ?? "").match(/Zero|One|Two/)?.[0] ?? "";

    act(() => void vi.advanceTimersByTime(900)); // tick 1 -> step 1
    notes.push(note());
    flushFrame(1000);
    flushFrame(1400); // glide 1 settles well inside the 900 ms interval
    expect(lastX()).toBe(140);

    act(() => void vi.advanceTimersByTime(900)); // tick 2 -> step 2
    notes.push(note());
    flushFrame(2000);
    flushFrame(2400);
    expect(lastX()).toBe(240);

    expect(notes).toEqual(["One", "Two"]);
    expect(button("Play")).toBeTruthy(); // reached the end and stopped
  });

  it("base params are never mutated by gliding", () => {
    const config = structuredClone(CONFIG);
    const before = JSON.stringify(config.elements);
    mount(config);
    click("Step forward");
    flushFrame(1000);
    flushFrame(1200);
    flushFrame(1400);
    expect(JSON.stringify(config.elements)).toBe(before);
  });
});

describe("ComposedScene — text alternative for the current step (R4)", () => {
  it("points the canvas at the step note so assistive tech can read what it shows", () => {
    mount();
    const canvas = container.querySelector("canvas")!;
    const id = canvas.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    const described = container.ownerDocument.getElementById(id!);
    expect(described?.textContent).toContain("Zero");
    click("Step forward");
    expect(container.ownerDocument.getElementById(id!)?.textContent).toContain("One");
  });

  it("sets no aria-describedby when there is no note to point at", () => {
    // (Two note-less steps rather than one: jsdom's CSS parser rejects the
    // calc(NaN%) a one-step scrubber's thumb gets, which browsers ignore.)
    mount({ ...CONFIG, steps: [{ overrides: {} }, { overrides: {} }] });
    expect(container.querySelector("canvas")!.hasAttribute("aria-describedby")).toBe(false);
    mount({ canvas: CONFIG.canvas, elements: CONFIG.elements });
    expect(container.querySelector("canvas")!.hasAttribute("aria-describedby")).toBe(false);
  });
});
