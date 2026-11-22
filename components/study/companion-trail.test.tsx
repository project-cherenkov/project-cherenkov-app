// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionTrail, MAX_PIXEL_CELL, pixelCells } from "./companion-trail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let reduced = false;
let x = 100;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance", "Date"] });
  x = 100;
  reduced = false;
  window.matchMedia = ((query: string) => ({ matches: reduced, media: query, addEventListener() {}, removeEventListener() {} })) as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function mount(enabled = true) {
  const ref = createRef<HTMLButtonElement>();
  const button = document.createElement("button");
  button.getBoundingClientRect = () => ({ left: x, top: 200, width: 40, height: 40, right: x + 40, bottom: 240, x, y: 200, toJSON() {} }) as DOMRect;
  (ref as { current: HTMLButtonElement | null }).current = button;
  act(() => root.render(<CompanionTrail targetRef={ref} enabled={enabled} active />));
}

function moveFor(ticks: number) {
  for (let i = 0; i < ticks; i += 1) {
    x += 20;
    act(() => { vi.advanceTimersByTime(110); });
  }
}

describe("CompanionTrail", () => {
  it("draws stars, polygons and pixel cells together", () => {
    mount();
    moveFor(12);
    expect(container.querySelectorAll(".companion-cosmos-star").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".companion-cosmos-lattice").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".companion-cosmos-pixel").length).toBeGreaterThan(0);
  });

  it("keeps pixel cells on the 2px grid and never larger than 6px", () => {
    mount();
    moveFor(30);
    const cells = [...container.querySelectorAll(".companion-cosmos-pixel")];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      const w = Number(cell.getAttribute("width"));
      expect(w % 2).toBe(0);
      expect(w).toBeLessThanOrEqual(MAX_PIXEL_CELL);
      expect(Number(cell.getAttribute("x")) % 2).toBe(0);
    }
  });

  it("gives every pixel cell its own lifetime for the CSS fade", () => {
    mount();
    moveFor(5);
    const cell = container.querySelector<SVGElement>(".companion-cosmos-pixel")!;
    const ms = parseInt(cell.style.animationDuration, 10);
    expect(ms).toBeGreaterThanOrEqual(900);
    expect(ms).toBeLessThanOrEqual(1200);
  });

  it("removes everything once the mascot stops and the lives run out", () => {
    mount();
    moveFor(6);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(container.querySelectorAll("svg > *").length).toBe(0);
  });

  it("is static under reduced motion", () => {
    reduced = true;
    mount();
    moveFor(6);
    const cell = container.querySelector<SVGElement>(".companion-cosmos-pixel")!;
    expect(cell.style.opacity).toBe("0.55");
    expect(cell.style.animationDuration).toBe("");
  });

  it("emits nothing when disabled", () => {
    mount(false);
    moveFor(6);
    expect(container.querySelectorAll("svg > *").length).toBe(0);
  });
});

describe("pixelCells", () => {
  it("emits one or two cells with a mix of sizes", () => {
    const sizes = new Set<number>();
    for (let id = 0; id < 400; id += 3) {
      const cells = pixelCells(id, 50, 50, 10, 0, 0);
      expect(cells.length).toBeGreaterThanOrEqual(1);
      expect(cells.length).toBeLessThanOrEqual(2);
      for (const c of cells) sizes.add(c.cell);
    }
    expect([...sizes].sort()).toEqual([2, 4, 6]);
  });
});
