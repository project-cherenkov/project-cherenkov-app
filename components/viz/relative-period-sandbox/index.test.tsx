// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useLocale: () => "en",
    useTranslations: (namespace: string) => actual.createTranslator({ locale: "en", messages: en, namespace }),
  };
});

import { RelativePeriodSandbox } from "./index";
import type { RelativePeriodSandboxConfig } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let width = 600;
class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(target: Element) {
    this.cb([{ target, contentRect: { width } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  width = 600;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function mount(config: RelativePeriodSandboxConfig = {}) {
  act(() => root.render(<RelativePeriodSandbox config={config} />));
}
const text = () => container.textContent ?? "";
const select = () => container.querySelector("select") as HTMLSelectElement;
const button = (label: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.getAttribute("aria-label") === label || b.textContent === label,
  ) as HTMLButtonElement;
const click = (el: Element) => act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

function chooseMode(value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setter.call(select(), value);
    select().dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("RelativePeriodSandbox", () => {
  it("opens in the configured mode, paused at the start of the cycle", () => {
    mount({ mode: "planetary-orbits" });
    expect(select().value).toBe("planetary-orbits");
    expect(text()).toContain("Synodic period");
    expect(text()).toContain("398.901 d");
    expect(text()).toContain("Cycle position: 0%");
    expect(button("Play")).toBeTruthy();
  });

  it("defaults to Earth's day and reads 24 h for the mean solar day", () => {
    mount();
    expect(select().value).toBe("earth-day");
    expect(text()).toContain("1.000000 d (24 h 0 min 0.0 s)");
    expect(text()).toContain("23 h 56 min 4.1 s");
    expect(text()).toContain("0.9856°");
  });

  it("the mode selector is available in both modes and switching resets the cycle", () => {
    mount();
    click(button("Step forward"));
    expect(text()).toContain("Cycle position: 1%");
    chooseMode("planetary-orbits");
    expect(text()).toContain("Cycle position: 0%");
    expect(text()).toContain("Period of planet B");
    chooseMode("earth-day");
    expect(text()).toContain("Sidereal rotation period");
  });

  it("step and reset move the cycle position by whole hundredths", () => {
    mount();
    click(button("Step forward"));
    click(button("Step forward"));
    expect(text()).toContain("Cycle position: 2%");
    click(button("Step back"));
    expect(text()).toContain("Cycle position: 1%");
    click(button("Reset"));
    expect(text()).toContain("Cycle position: 0%");
  });

  it("clamps at the ends instead of wrapping", () => {
    mount();
    click(button("Step back"));
    expect(text()).toContain("Cycle position: 0%");
    click(button("Jump to solar return"));
    expect(text()).toContain("Cycle position: 100%");
    click(button("Step forward"));
    expect(text()).toContain("Cycle position: 100%");
  });

  it("the jump buttons land on the two recurrence events", () => {
    mount();
    click(button("Jump to sidereal return"));
    expect(text()).toContain("✓ Marked meridian points at the star reference");
    expect(text()).toContain("○ Marked meridian points at the Sun");
    click(button("Jump to solar return"));
    expect(text()).toContain("✓ Marked meridian points at the Sun");
  });

  it("describes the canvas with the static text alternative", () => {
    mount({ mode: "planetary-orbits" });
    const label = container.querySelector("canvas")!.getAttribute("aria-label")!;
    expect(label).toContain("Planetary orbits model is at 0% of a synodic cycle");
    expect(label).toContain("the calculated recurrence period is 398.901 d");
  });

  it("uses the wide two-column layout only when the container is wide enough", () => {
    mount();
    expect(container.querySelector(".grid")!.className).toContain("grid-cols-1");
    act(() => root.unmount());
    width = 1000;
    root = createRoot(container);
    mount();
    expect(container.querySelector(".grid")!.className).toContain("13fr");
  });
});
