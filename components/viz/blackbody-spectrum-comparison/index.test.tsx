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
    useTranslations: (namespace: string) =>
      actual.createTranslator({ locale: "en", messages: en, namespace }),
  };
});

import { BlackbodySpectrumComparison } from "./index";
import type { BlackbodySpectrumComparisonConfig } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    this.cb([{ contentRect: { width: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  HTMLCanvasElement.prototype.getContext = (() => null) as never; // no canvas in jsdom: drawing is skipped
  HTMLElement.prototype.setPointerCapture = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function mount(config: BlackbodySpectrumComparisonConfig = {}) {
  act(() => root.render(<BlackbodySpectrumComparison config={config} />));
}

const canvas = () => container.querySelector("canvas") as HTMLCanvasElement;
const select = () => container.querySelector("select") as HTMLSelectElement;
const thumb = () => container.querySelector('span[role="slider"]') as HTMLElement;
const text = () => container.textContent ?? "";
const legend = () => container.querySelector("ul")?.textContent ?? "";

function key(el: Element, k: string, init: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
  });
}

function chooseMode(value: string) {
  act(() => {
    select().value = value;
    select().dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("BlackbodySpectrumComparison: initial state", () => {
  it("starts on 'Both' at 6000 K with the peak readout at 483 nm", () => {
    mount();
    expect(select().value).toBe("both");
    expect(text()).toContain("Temperature: 6,000 K");
    expect(text()).toContain("Planck peak wavelength: 483 nm");
    expect(legend()).toContain("Planck's law");
    expect(legend()).toContain("Rayleigh–Jeans law");
  });

  it("offers the three graph modes in the brief's order", () => {
    mount();
    expect([...select().options].map((o) => o.textContent)).toEqual([
      "Rayleigh–Jeans law",
      "Planck's law",
      "Both",
    ]);
  });

  it("shows a cursor readout before any interaction (400 nm, ratio about 67)", () => {
    mount();
    const dds = [...container.querySelectorAll("dd")].map((d) => d.textContent);
    expect(dds[0]).toBe("400 nm");
    expect(dds[3]).toMatch(/^6\.\d\d × 101$/);
  });

  it("honours the config's starting temperature and range", () => {
    mount({ temperatureK: 9000, temperatureRangeK: [6000, 12000], temperatureStepK: 500 });
    expect(text()).toContain("Temperature: 9,000 K");
    expect(thumb().getAttribute("aria-valuemin")).toBe("6000");
    expect(thumb().getAttribute("aria-valuemax")).toBe("12000");
  });

  it("shows no out-of-range notice at the default settings", () => {
    mount();
    expect(text()).not.toContain("Value outside the display range");
  });

  it("states the finite-window and ideal-blackbody limits", () => {
    mount();
    expect(text()).toContain("The left edge is 100 nm, not zero wavelength.");
    expect(text()).toContain("ideal blackbody in thermal equilibrium");
  });
});

describe("BlackbodySpectrumComparison: controls", () => {
  it("the mode selector changes the legend and leaves the readout alone", () => {
    mount();
    const before = [...container.querySelectorAll("dd")].map((d) => d.textContent);
    chooseMode("planck");
    expect(legend()).toContain("Planck's law");
    expect(legend()).not.toContain("Rayleigh–Jeans law");
    chooseMode("rayleigh-jeans");
    expect(legend()).toContain("Rayleigh–Jeans law");
    expect(legend()).not.toContain("Planck");
    // The readout reports both laws whichever curve is drawn.
    expect([...container.querySelectorAll("dd")].map((d) => d.textContent)).toEqual(before);
  });

  it("the temperature slider has an accessible name and moves in 250 K steps", () => {
    mount();
    expect(thumb().getAttribute("aria-label")).toBe("Temperature (K)");
    key(thumb(), "ArrowRight");
    expect(text()).toContain("Temperature: 6,250 K");
    expect(text()).toContain("Planck peak wavelength: 464 nm");
    key(thumb(), "Home");
    expect(text()).toContain("Temperature: 3,000 K");
    expect(text()).toContain("Planck peak wavelength: 966 nm");
    key(thumb(), "End");
    expect(text()).toContain("Temperature: 12,000 K");
    expect(text()).toContain("Planck peak wavelength: 241 nm");
  });

  it("a temperature change updates the cursor readout at the same wavelength", () => {
    mount();
    const ratio = () => [...container.querySelectorAll("dd")][3]!.textContent;
    const at6000 = ratio();
    key(thumb(), "End");
    expect(ratio()).not.toBe(at6000);
  });
});

describe("BlackbodySpectrumComparison: keyboard cursor", () => {
  it("is a focusable slider over 100–100,000 nm with a text value", () => {
    mount();
    expect(canvas().getAttribute("role")).toBe("slider");
    expect(canvas().tabIndex).toBe(0);
    expect(canvas().getAttribute("aria-valuemin")).toBe("100");
    expect(canvas().getAttribute("aria-valuemax")).toBe("100000");
    expect(canvas().getAttribute("aria-valuetext")).toContain("Planck spectral radiance");
    expect(canvas().getAttribute("aria-valuetext")).toContain("Rayleigh–Jeans / Planck ratio");
  });

  it("left/right move in logarithmic steps, Shift in bigger ones", () => {
    mount();
    const now = () => Number(canvas().getAttribute("aria-valuenow"));
    expect(now()).toBe(400);
    key(canvas(), "ArrowRight");
    const one = now();
    expect(one).toBeGreaterThan(400);
    key(canvas(), "ArrowLeft");
    expect(now()).toBe(400);
    key(canvas(), "ArrowRight", { shiftKey: true });
    const ten = now();
    // Log spacing: ten steps are a ten-times-larger ratio.
    expect(Math.log(ten / 400) / Math.log(one / 400)).toBeCloseTo(10, 0);
  });

  it("Home and End jump to the edges and the cursor never leaves the window", () => {
    mount();
    key(canvas(), "Home");
    expect(canvas().getAttribute("aria-valuenow")).toBe("100");
    key(canvas(), "ArrowLeft");
    expect(canvas().getAttribute("aria-valuenow")).toBe("100");
    key(canvas(), "End");
    expect(canvas().getAttribute("aria-valuenow")).toBe("100000");
    key(canvas(), "ArrowRight");
    expect(canvas().getAttribute("aria-valuenow")).toBe("100000");
  });

  it("the readout follows the cursor: at 100 nm and 3000 K the ratio is about 1.4 × 10^19", () => {
    mount({ temperatureK: 3000 });
    key(canvas(), "Home");
    const dds = [...container.querySelectorAll("dd")];
    expect(dds[0]!.textContent).toBe("100 nm");
    expect(dds[1]!.textContent).toMatch(/^1\.77 × 10−2 W m−3 sr−1$/);
    expect(dds[3]!.textContent).toBe("1.40 × 1019");
  });

  it("announces keyboard moves politely and stays quiet otherwise", () => {
    mount();
    const live = () => container.querySelector("dl")!.getAttribute("aria-live");
    expect(live()).toBe("off");
    key(canvas(), "ArrowRight");
    expect(live()).toBe("polite");
  });

  it("ignores other keys", () => {
    mount();
    key(canvas(), "a");
    key(canvas(), "Tab");
    expect(canvas().getAttribute("aria-valuenow")).toBe("400");
  });
});

describe("BlackbodySpectrumComparison: pointer cursor", () => {
  function pointer(type: string, clientX: number, init: PointerEventInit = {}) {
    act(() => {
      canvas().dispatchEvent(
        new PointerEvent(type, { bubbles: true, clientX, pointerType: "mouse", ...init }),
      );
    });
  }

  beforeEach(() => {
    HTMLCanvasElement.prototype.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 376, right: 600, bottom: 376, x: 0, y: 0, toJSON() {} }) as DOMRect;
  });

  it("hovering with a mouse moves the cursor; the far left is 100 nm, the far right 100,000 nm", () => {
    mount();
    pointer("pointermove", 0);
    expect(canvas().getAttribute("aria-valuenow")).toBe("100");
    pointer("pointermove", 600);
    expect(canvas().getAttribute("aria-valuenow")).toBe("100000");
  });

  it("maps pixels logarithmically: the middle of the plot is the geometric middle, 3,160 nm", () => {
    mount();
    // Layout at 600 px has a 62 px left and a 14 px right gutter, so the
    // plot's midpoint pixel is (62 + (600 - 14)) / 2.
    pointer("pointermove", (62 + (600 - 14)) / 2);
    const nm = Number(canvas().getAttribute("aria-valuenow"));
    expect(nm / 3162).toBeGreaterThan(0.97);
    expect(nm / 3162).toBeLessThan(1.03);
  });

  it("touch only scrubs while pressed, so a swipe can still scroll", () => {
    mount();
    pointer("pointermove", 0, { pointerType: "touch", buttons: 0 });
    expect(canvas().getAttribute("aria-valuenow")).toBe("400");
    pointer("pointerdown", 0, { pointerType: "touch", buttons: 1 });
    expect(canvas().getAttribute("aria-valuenow")).toBe("100");
  });

  it("a pointer move switches the live region back off", () => {
    mount();
    key(canvas(), "ArrowRight");
    pointer("pointermove", 300);
    expect(container.querySelector("dl")!.getAttribute("aria-live")).toBe("off");
  });
});

describe("BlackbodySpectrumComparison: accessibility text", () => {
  it("describes the graph for screen readers with the live temperature, peak and mode", () => {
    mount();
    const id = canvas().getAttribute("aria-describedby")!;
    const description = document.getElementById(id)!.textContent!;
    expect(description).toContain("At 6,000 kelvin, the Planck spectrum peaks near 483 nanometres.");
    expect(description).toContain("The graph currently shows both curves.");
    expect(description).toContain("100 to 100,000 nanometres on a logarithmic scale");
    chooseMode("planck");
    expect(document.getElementById(id)!.textContent).toContain("shows the Planck curve only");
    key(thumb(), "End");
    expect(document.getElementById(id)!.textContent).toContain("At 12,000 kelvin");
  });

  it("speaks exponents as superscripts and draws them as <sup>", () => {
    mount();
    expect(canvas().getAttribute("aria-valuetext")).toContain("W m⁻³ sr⁻¹");
    expect(container.querySelector("dd sup")).not.toBeNull();
    expect(text()).not.toContain("^");
  });

  it("has no animation, so there is nothing for reduced-motion to switch off", () => {
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    mount();
    key(thumb(), "ArrowRight");
    expect(raf).not.toHaveBeenCalled();
  });
});
