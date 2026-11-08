// Geometry for the draggable launch-angle handle (R2,
// docs/design/visualization-interactions.md). Pure functions, no React, so the
// drawing code, the handle element and the tests all share one definition.
//
// Why the handle sits at a FIXED radius from the launch origin rather than at
// the end of the arc: the drawing scale refits whenever range or peak
// changes, so anything pinned to the arc would slide under the reader's
// finger mid-drag. The launch origin is (PADDING_PX, CANVAS_HEIGHT -
// PADDING_PX) in CSS pixels and does not depend on that scale.

export const CANVAS_HEIGHT = 220;
export const PADDING_PX = 24;
/** Distance from the launch origin to the handle's centre, in CSS pixels. */
export const HANDLE_RADIUS_PX = 48;
/** Hit-area diameter of the handle, in CSS pixels. */
export const HANDLE_SIZE_PX = 36;

export interface Point {
  x: number;
  y: number;
}

/** Launch origin in canvas CSS pixels (y grows downward). */
export function launchOrigin(): Point {
  return { x: PADDING_PX, y: CANVAS_HEIGHT - PADDING_PX };
}

/** Centre of the handle, in canvas CSS pixels, for a launch angle. */
export function handleCentre(angleDeg: number): Point {
  const origin = launchOrigin();
  const theta = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + HANDLE_RADIUS_PX * Math.cos(theta),
    y: origin.y - HANDLE_RADIUS_PX * Math.sin(theta),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Snaps to the slider's own grid (min, min + step, ...), then clamps to the
 * range, so dragging, the arrow keys and the angle slider always agree on
 * which angles exist.
 */
export function snapToStep(value: number, range: [number, number], step: number): number {
  const snapped = range[0] + Math.round((value - range[0]) / step) * step;
  return clamp(snapped, range[0], range[1]);
}

/**
 * Launch angle implied by a pointer position (canvas CSS pixels): the angle
 * of the pointer around the launch origin, snapped and clamped to the
 * allowed range. A pointer left of or below the origin therefore pins to the
 * range's upper or lower bound instead of producing an out-of-range value.
 */
export function angleFromPointer(
  pointer: Point,
  range: [number, number],
  step: number,
): number {
  const origin = launchOrigin();
  const dx = pointer.x - origin.x;
  const dy = origin.y - pointer.y; // flip: screen y grows downward
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  return snapToStep(degrees, range, step);
}

/** Keyboard step for the handle: 1° per arrow press, 5° with Shift. */
export function keyboardAngleDelta(key: string, shiftKey: boolean): number | null {
  const size = shiftKey ? 5 : 1;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return size;
    case "ArrowLeft":
    case "ArrowDown":
      return -size;
    default:
      return null;
  }
}
