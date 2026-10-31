import { describe, expect, it } from "vitest";
import {
  DOCK_MARGIN,
  clampPixels,
  parseStoredPosition,
  pixelsToPosition,
  placePanel,
  positionToPixels,
} from "./companion-position";

const desktop = { width: 1280, height: 800 };
const size = 76;

describe("dock position", () => {
  it("puts the default (1,1) in the bottom-right corner with a margin", () => {
    const { left, top } = positionToPixels({ x: 1, y: 1 }, desktop, size);
    expect(left).toBe(desktop.width - size - DOCK_MARGIN);
    expect(top).toBe(desktop.height - size - DOCK_MARGIN);
  });

  it("round-trips pixels and fractions", () => {
    const position = pixelsToPosition(300, 200, desktop, size);
    const { left, top } = positionToPixels(position, desktop, size);
    expect(left).toBeCloseTo(300);
    expect(top).toBeCloseTo(200);
  });

  it("keeps the mascot on screen after the window shrinks", () => {
    const small = { width: 390, height: 600 };
    const { left, top } = positionToPixels({ x: 1, y: 1 }, small, size);
    expect(left + size).toBeLessThanOrEqual(small.width);
    expect(top + size).toBeLessThanOrEqual(small.height);
  });

  it("clamps drags that leave the viewport", () => {
    const clamped = clampPixels(-500, 5000, desktop, size);
    expect(clamped.left).toBe(DOCK_MARGIN);
    expect(clamped.top).toBe(desktop.height - size - DOCK_MARGIN);
  });

  it("does not divide by zero when the viewport is smaller than the mascot", () => {
    const tiny = { width: 60, height: 60 };
    const position = pixelsToPosition(0, 0, tiny, size);
    expect(Number.isFinite(position.x)).toBe(true);
    expect(Number.isFinite(position.y)).toBe(true);
  });
});

describe("parseStoredPosition", () => {
  it("accepts and clamps valid values", () => {
    expect(parseStoredPosition('{"x":0.25,"y":2}')).toEqual({ x: 0.25, y: 1 });
  });
  it("rejects garbage", () => {
    expect(parseStoredPosition(null)).toBeNull();
    expect(parseStoredPosition("not json")).toBeNull();
    expect(parseStoredPosition('{"x":"a","y":1}')).toBeNull();
    expect(parseStoredPosition('{"x":1}')).toBeNull();
  });
});

describe("placePanel", () => {
  it("uses a bottom sheet on phones", () => {
    expect(placePanel({ left: 300, top: 500, size }, { width: 390, height: 800 })).toEqual({ mode: "sheet" });
  });

  it("opens above a mascot in the bottom-right corner and stays inside the viewport", () => {
    const anchor = { left: desktop.width - size - 16, top: desktop.height - size - 16, size };
    const placement = placePanel(anchor, desktop);
    if (placement.mode !== "floating") throw new Error("expected floating");
    expect(placement.top + placement.height).toBeLessThanOrEqual(anchor.top);
    expect(placement.left).toBeGreaterThanOrEqual(16);
    expect(placement.left + placement.width).toBeLessThanOrEqual(desktop.width - 16);
  });

  it("opens below a mascot dragged to the top", () => {
    const placement = placePanel({ left: 600, top: 16, size }, desktop);
    if (placement.mode !== "floating") throw new Error("expected floating");
    expect(placement.top).toBeGreaterThanOrEqual(16 + size);
    expect(placement.top + placement.height).toBeLessThanOrEqual(desktop.height);
  });
});
