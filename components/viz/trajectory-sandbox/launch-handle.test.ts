import { describe, expect, it } from "vitest";

import {
  CANVAS_HEIGHT,
  HANDLE_RADIUS_PX,
  PADDING_PX,
  angleFromPointer,
  handleCentre,
  keyboardAngleDelta,
  launchOrigin,
  snapToStep,
} from "./launch-handle";

const RANGE: [number, number] = [5, 85];

describe("launch handle geometry (R2)", () => {
  it("the launch origin is the bottom-left padding corner and does not depend on any scale", () => {
    expect(launchOrigin()).toEqual({ x: PADDING_PX, y: CANVAS_HEIGHT - PADDING_PX });
  });

  it("the handle sits at a fixed radius from the origin for every angle", () => {
    const o = launchOrigin();
    for (const angle of [5, 30, 45, 60, 85]) {
      const h = handleCentre(angle);
      expect(Math.hypot(h.x - o.x, h.y - o.y)).toBeCloseTo(HANDLE_RADIUS_PX, 9);
    }
  });

  it("angleFromPointer inverts handleCentre for whole-degree angles", () => {
    for (const angle of [5, 17, 45, 63, 85]) {
      expect(angleFromPointer(handleCentre(angle), RANGE, 1)).toBe(angle);
    }
  });

  it("measures the angle from wherever along the ray the pointer is, not only at the handle's radius", () => {
    const o = launchOrigin();
    const theta = (60 * Math.PI) / 180;
    expect(angleFromPointer({ x: o.x + 200 * Math.cos(theta), y: o.y - 200 * Math.sin(theta) }, RANGE, 1)).toBe(60);
  });

  it("clamps to the allowed range instead of leaving it", () => {
    const o = launchOrigin();
    // Straight up-left of the origin: > 90°, pinned to the upper bound.
    expect(angleFromPointer({ x: o.x - 50, y: o.y - 50 }, RANGE, 1)).toBe(85);
    // Below the ground line: negative, pinned to the lower bound.
    expect(angleFromPointer({ x: o.x + 50, y: o.y + 50 }, RANGE, 1)).toBe(5);
    // Exactly horizontal.
    expect(angleFromPointer({ x: o.x + 50, y: o.y }, RANGE, 1)).toBe(5);
  });

  it("respects a narrower configured angleRange", () => {
    const o = launchOrigin();
    expect(angleFromPointer({ x: o.x + 10, y: o.y - 100 }, [20, 60], 1)).toBe(60);
    expect(angleFromPointer({ x: o.x + 100, y: o.y - 1 }, [20, 60], 1)).toBe(20);
  });

  it("snaps to the slider's own grid, including a non-integer minimum", () => {
    expect(snapToStep(46.4, RANGE, 1)).toBe(46);
    expect(snapToStep(46.6, RANGE, 1)).toBe(47);
    // Grid for range [5.5, 80] is 5.5, 6.5, 7.5, ...
    expect(snapToStep(46.4, [5.5, 80], 1)).toBe(46.5);
    expect(snapToStep(200, [5.5, 80], 1)).toBe(80);
  });

  it("maps arrow keys to 1° and Shift+arrow to 5°, and ignores other keys", () => {
    expect(keyboardAngleDelta("ArrowRight", false)).toBe(1);
    expect(keyboardAngleDelta("ArrowUp", false)).toBe(1);
    expect(keyboardAngleDelta("ArrowLeft", false)).toBe(-1);
    expect(keyboardAngleDelta("ArrowDown", false)).toBe(-1);
    expect(keyboardAngleDelta("ArrowRight", true)).toBe(5);
    expect(keyboardAngleDelta("ArrowDown", true)).toBe(-5);
    expect(keyboardAngleDelta("a", false)).toBeNull();
  });
});
