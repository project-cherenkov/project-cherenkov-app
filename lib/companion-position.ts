// Pure geometry for the draggable companion dock. The position is stored as a
// fraction (0..1) of the space the mascot can travel in, not as pixels, so a
// window resize or a rotated phone never strands it off-screen.

export type DockPosition = { x: number; y: number };
export type Viewport = { width: number; height: number };

export const DOCK_MARGIN = 16;
export const DEFAULT_DOCK_POSITION: DockPosition = { x: 1, y: 1 }; // bottom-right

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function travel(viewport: Viewport, size: number) {
  return {
    width: Math.max(0, viewport.width - size - DOCK_MARGIN * 2),
    height: Math.max(0, viewport.height - size - DOCK_MARGIN * 2),
  };
}

export function positionToPixels(position: DockPosition, viewport: Viewport, size: number) {
  const room = travel(viewport, size);
  return {
    left: DOCK_MARGIN + clamp(position.x, 0, 1) * room.width,
    top: DOCK_MARGIN + clamp(position.y, 0, 1) * room.height,
  };
}

export function pixelsToPosition(left: number, top: number, viewport: Viewport, size: number): DockPosition {
  const room = travel(viewport, size);
  return {
    x: room.width === 0 ? 1 : clamp((left - DOCK_MARGIN) / room.width, 0, 1),
    y: room.height === 0 ? 1 : clamp((top - DOCK_MARGIN) / room.height, 0, 1),
  };
}

export function clampPixels(left: number, top: number, viewport: Viewport, size: number) {
  const room = travel(viewport, size);
  return {
    left: clamp(left, DOCK_MARGIN, DOCK_MARGIN + room.width),
    top: clamp(top, DOCK_MARGIN, DOCK_MARGIN + room.height),
  };
}

export function parseStoredPosition(raw: string | null): DockPosition | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof value.x !== "number" || typeof value.y !== "number") return null;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    return { x: clamp(value.x, 0, 1), y: clamp(value.y, 0, 1) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The panel that opens beside the mascot.
//
// The panel is attached to the mascot like a speech bubble: the edge that
// faces the mascot (above or below it) and the side that lines up with it stay
// put, and the two *free* edges move. That is why resizing needs no "snap
// back" afterwards: dragging a free edge changes the size, and placing the
// panel again with that size puts it exactly where the drag left it.
// ---------------------------------------------------------------------------

export type PanelSize = { width: number; height: number };
export type PanelFrame = PanelSize & { left: number; top: number };
export type PanelEdge = "left" | "right" | "top" | "bottom";

export const DEFAULT_PANEL_SIZE: PanelSize = { width: 384, height: 640 };
export const MIN_PANEL_SIZE: PanelSize = { width: 300, height: 320 };
export const PANEL_MARGIN = 16;
export const PANEL_GAP = 12;
// Keyboard resizing: one arrow press, and one arrow press with Shift held.
export const PANEL_KEY_STEP = 24;
export const PANEL_KEY_STEP_LARGE = 96;

export type PanelPlacement =
  | { mode: "sheet" }
  | ({
      mode: "floating";
      // Which side edge and which top/bottom edge the user can drag. The
      // opposite two are attached to the mascot.
      freeHorizontal: "left" | "right";
      freeVertical: "top" | "bottom";
    } & PanelFrame);

// Phones get a bottom sheet; everything else gets a panel anchored beside the
// mascot, on the side (above or below) that has more room.
export const SHEET_BREAKPOINT = 640;

export function placePanel(
  anchor: { left: number; top: number; size: number },
  viewport: Viewport,
  requested: Partial<PanelSize> = {},
): PanelPlacement {
  if (viewport.width < SHEET_BREAKPOINT) return { mode: "sheet" };

  const width = clamp(requested.width ?? DEFAULT_PANEL_SIZE.width, MIN_PANEL_SIZE.width, viewport.width - PANEL_MARGIN * 2);
  const wanted = clamp(requested.height ?? DEFAULT_PANEL_SIZE.height, MIN_PANEL_SIZE.height, viewport.height - PANEL_MARGIN * 2);

  // Horizontal: line the panel up with the mascot's own side, so a mascot in
  // the right half has its panel growing leftwards (and the other way round).
  const rightSide = anchor.left + anchor.size / 2 > viewport.width / 2;
  const alignedLeft = rightSide ? anchor.left + anchor.size - width : anchor.left;
  const left = clamp(alignedLeft, PANEL_MARGIN, viewport.width - width - PANEL_MARGIN);

  // Vertical: above or below the mascot, whichever has more room. The height
  // never reaches into the mascot unless neither side has room for the minimum.
  const above = anchor.top - PANEL_GAP - PANEL_MARGIN;
  const below = viewport.height - (anchor.top + anchor.size + PANEL_GAP) - PANEL_MARGIN;
  const placeAbove = above >= below;
  const room = placeAbove ? above : below;
  const height = Math.max(Math.min(wanted, room), MIN_PANEL_SIZE.height);
  const desiredTop = placeAbove ? anchor.top - PANEL_GAP - height : anchor.top + anchor.size + PANEL_GAP;
  const top = clamp(desiredTop, PANEL_MARGIN, viewport.height - height - PANEL_MARGIN);

  return {
    mode: "floating",
    left,
    top,
    width,
    height,
    freeHorizontal: rightSide ? "left" : "right",
    freeVertical: placeAbove ? "top" : "bottom",
  };
}

/**
 * The frame after dragging one or two edges by (dx, dy) from `start`. The
 * edges that are not dragged stay exactly where they are, the size never drops
 * below the minimum, and the panel never leaves the viewport margin.
 */
export function resizeFrame(
  start: PanelFrame,
  edges: readonly PanelEdge[],
  dx: number,
  dy: number,
  viewport: Viewport,
): PanelFrame {
  let { left, top, width, height } = start;
  const right = start.left + start.width;
  const bottom = start.top + start.height;

  if (edges.includes("left")) {
    left = clamp(start.left + dx, PANEL_MARGIN, right - MIN_PANEL_SIZE.width);
    width = right - left;
  } else if (edges.includes("right")) {
    width = clamp(start.width + dx, MIN_PANEL_SIZE.width, viewport.width - PANEL_MARGIN - start.left);
  }

  if (edges.includes("top")) {
    top = clamp(start.top + dy, PANEL_MARGIN, bottom - MIN_PANEL_SIZE.height);
    height = bottom - top;
  } else if (edges.includes("bottom")) {
    height = clamp(start.height + dy, MIN_PANEL_SIZE.height, viewport.height - PANEL_MARGIN - start.top);
  }

  return { left, top, width, height };
}

/**
 * Turns one arrow key into a resize of the given free edge. Arrow keys move
 * the edge itself: Left on the left edge makes the panel wider, Right on the
 * same edge makes it narrower. Returns null for keys that mean nothing here.
 */
export function keyboardResize(
  start: PanelFrame,
  edge: PanelEdge,
  key: string,
  large: boolean,
  viewport: Viewport,
): PanelFrame | null {
  const step = large ? PANEL_KEY_STEP_LARGE : PANEL_KEY_STEP;
  const horizontal = edge === "left" || edge === "right";
  const delta =
    horizontal && key === "ArrowLeft" ? -step
    : horizontal && key === "ArrowRight" ? step
    : !horizontal && key === "ArrowUp" ? -step
    : !horizontal && key === "ArrowDown" ? step
    : null;
  if (delta === null) return null;
  return resizeFrame(start, [edge], horizontal ? delta : 0, horizontal ? 0 : delta, viewport);
}

/** Reads a saved panel size. Anything that is not two finite numbers is ignored. */
export function parseStoredPanelSize(raw: string | null): PanelSize | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { width?: unknown; height?: unknown };
    if (typeof value.width !== "number" || typeof value.height !== "number") return null;
    if (!Number.isFinite(value.width) || !Number.isFinite(value.height)) return null;
    // 4000px is far beyond any real window; it only stops absurd stored values.
    return {
      width: clamp(Math.round(value.width), MIN_PANEL_SIZE.width, 4000),
      height: clamp(Math.round(value.height), MIN_PANEL_SIZE.height, 4000),
    };
  } catch {
    return null;
  }
}
