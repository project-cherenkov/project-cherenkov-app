import { describe, expect, it } from "vitest";
import {
  DOCK_MARGIN,
  MIN_PANEL_SIZE,
  PANEL_MARGIN,
  clampPixels,
  keyboardResize,
  parseStoredPanelSize,
  parseStoredPosition,
  pixelsToPosition,
  placePanel,
  positionToPixels,
  resizeFrame,
  type PanelFrame,
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

function floating(anchor: { left: number; top: number; size: number }, viewport = desktop, requested = {}) {
  const placement = placePanel(anchor, viewport, requested);
  if (placement.mode !== "floating") throw new Error("expected floating");
  return placement;
}

describe("placePanel with a chosen size", () => {
  const corner = { left: desktop.width - size - 16, top: desktop.height - size - 16, size };

  it("keeps the default size when none is chosen", () => {
    const placement = floating(corner);
    expect(placement.width).toBe(384);
    expect(placement.height).toBe(640);
  });

  it("uses the chosen size and keeps the panel on screen", () => {
    const placement = floating(corner, desktop, { width: 520, height: 400 });
    expect(placement.width).toBe(520);
    expect(placement.height).toBe(400);
    expect(placement.left + placement.width).toBeLessThanOrEqual(desktop.width - PANEL_MARGIN);
    expect(placement.top).toBeGreaterThanOrEqual(PANEL_MARGIN);
  });

  it("never exceeds the viewport or drops below the minimum", () => {
    const huge = floating(corner, desktop, { width: 9000, height: 9000 });
    expect(huge.width).toBe(desktop.width - PANEL_MARGIN * 2);
    expect(huge.top + huge.height).toBeLessThanOrEqual(corner.top);
    const tiny = floating(corner, desktop, { width: 10, height: 10 });
    expect(tiny.width).toBe(MIN_PANEL_SIZE.width);
    expect(tiny.height).toBe(MIN_PANEL_SIZE.height);
  });

  it("attaches to the mascot's side and says which edges are free", () => {
    const right = floating(corner);
    expect(right.freeHorizontal).toBe("left");
    expect(right.freeVertical).toBe("top");
    expect(right.left + right.width).toBe(corner.left + size);

    const topLeft = floating({ left: 16, top: 16, size });
    expect(topLeft.freeHorizontal).toBe("right");
    expect(topLeft.freeVertical).toBe("bottom");
    expect(topLeft.left).toBe(16);
    expect(topLeft.top).toBe(16 + size + 12);
  });

  it("stays inside the viewport on a short landscape screen", () => {
    const short = { width: 900, height: 380 };
    const placement = floating({ left: 400, top: 150, size }, short);
    expect(placement.top).toBeGreaterThanOrEqual(PANEL_MARGIN);
    expect(placement.top + placement.height).toBeLessThanOrEqual(short.height - PANEL_MARGIN);
  });
});

describe("resizeFrame", () => {
  const start: PanelFrame = { left: 700, top: 100, width: 384, height: 500 };

  it("dragging the left edge keeps the right edge fixed", () => {
    const next = resizeFrame(start, ["left"], -100, 0, desktop);
    expect(next.width).toBe(484);
    expect(next.left + next.width).toBe(start.left + start.width);
    expect(next.top).toBe(start.top);
    expect(next.height).toBe(start.height);
  });

  it("dragging the top edge keeps the bottom edge fixed", () => {
    const next = resizeFrame(start, ["top"], 0, -60, desktop);
    expect(next.height).toBe(560);
    expect(next.top + next.height).toBe(start.top + start.height);
  });

  it("dragging a corner changes both dimensions", () => {
    const next = resizeFrame(start, ["left", "top"], -50, -40, desktop);
    expect(next.width).toBe(434);
    expect(next.height).toBe(540);
  });

  it("dragging the right and bottom edges grows towards the free side", () => {
    const next = resizeFrame({ left: 16, top: 100, width: 384, height: 400 }, ["right", "bottom"], 80, 70, desktop);
    expect(next.width).toBe(464);
    expect(next.height).toBe(470);
    expect(next.left).toBe(16);
    expect(next.top).toBe(100);
  });

  it("stops at the minimum size without moving the fixed edge", () => {
    const next = resizeFrame(start, ["left", "top"], 900, 900, desktop);
    expect(next.width).toBe(MIN_PANEL_SIZE.width);
    expect(next.height).toBe(MIN_PANEL_SIZE.height);
    expect(next.left + next.width).toBe(start.left + start.width);
    expect(next.top + next.height).toBe(start.top + start.height);
  });

  it("stops at the viewport margin", () => {
    const next = resizeFrame(start, ["left", "top"], -5000, -5000, desktop);
    expect(next.left).toBe(PANEL_MARGIN);
    expect(next.top).toBe(PANEL_MARGIN);
    const grown = resizeFrame({ left: 16, top: 16, width: 384, height: 400 }, ["right", "bottom"], 5000, 5000, desktop);
    expect(grown.left + grown.width).toBe(desktop.width - PANEL_MARGIN);
    expect(grown.top + grown.height).toBe(desktop.height - PANEL_MARGIN);
  });

  it("a drag followed by placing the panel again gives the same frame (no jump on release)", () => {
    const anchor = { left: desktop.width - size - 16, top: desktop.height - size - 16, size };
    const initial = floating(anchor);
    const dragged = resizeFrame(initial, [initial.freeHorizontal, initial.freeVertical], -120, -150, desktop);
    const placed = floating(anchor, desktop, { width: dragged.width, height: dragged.height });
    expect(placed.left).toBe(dragged.left);
    expect(placed.top).toBe(dragged.top);
    expect(placed.width).toBe(dragged.width);
    expect(placed.height).toBe(dragged.height);
  });

  it("does the same when the panel hangs below a mascot at the top left", () => {
    const anchor = { left: 16, top: 16, size };
    const initial = floating(anchor, desktop, { height: 300 });
    const dragged = resizeFrame(initial, [initial.freeHorizontal, initial.freeVertical], 200, 120, desktop);
    const placed = floating(anchor, desktop, { width: dragged.width, height: dragged.height });
    expect(placed).toMatchObject({ left: dragged.left, top: dragged.top, width: dragged.width, height: dragged.height });
  });
});

describe("keyboardResize", () => {
  const frame: PanelFrame = { left: 700, top: 100, width: 384, height: 500 };

  it("moves the edge itself: ArrowLeft on the left edge widens, ArrowRight narrows", () => {
    expect(keyboardResize(frame, "left", "ArrowLeft", false, desktop)?.width).toBe(408);
    expect(keyboardResize(frame, "left", "ArrowRight", false, desktop)?.width).toBe(360);
  });

  it("uses a bigger step with Shift and the vertical arrows for top and bottom", () => {
    expect(keyboardResize({ ...frame, top: 300 }, "top", "ArrowUp", true, desktop)?.height).toBe(596);
    // From top 100 the same step would pass the screen margin, so it stops there.
    expect(keyboardResize(frame, "top", "ArrowUp", true, desktop)?.height).toBe(584);
    expect(keyboardResize(frame, "bottom", "ArrowDown", false, { width: 1280, height: 900 })?.height).toBe(524);
  });

  it("ignores keys that mean nothing on that edge", () => {
    expect(keyboardResize(frame, "left", "ArrowUp", false, desktop)).toBeNull();
    expect(keyboardResize(frame, "top", "ArrowLeft", false, desktop)).toBeNull();
    expect(keyboardResize(frame, "left", "a", false, desktop)).toBeNull();
  });
});

describe("parseStoredPanelSize", () => {
  it("accepts a valid size and enforces the minimum", () => {
    expect(parseStoredPanelSize('{"width":500.4,"height":600}')).toEqual({ width: 500, height: 600 });
    expect(parseStoredPanelSize('{"width":10,"height":10}')).toEqual(MIN_PANEL_SIZE);
  });
  it("rejects garbage", () => {
    expect(parseStoredPanelSize(null)).toBeNull();
    expect(parseStoredPanelSize("nope")).toBeNull();
    expect(parseStoredPanelSize('{"width":"500","height":600}')).toBeNull();
    expect(parseStoredPanelSize('{"width":500}')).toBeNull();
    expect(parseStoredPanelSize('{"width":1e999,"height":600}')).toBeNull();
  });
});
