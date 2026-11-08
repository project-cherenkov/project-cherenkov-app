// Shared devicePixelRatio + canvas-buffer-size setup, used by every canvas
// engine (composed-scene, programmable-scene, trajectory-sandbox,
// orbital-sandbox).
//
// History: extracted per SCENE-004 ("shared scale/coordinate helpers ...
// extract these from the existing engines if not already factored out") for
// composed-scene. trajectory-sandbox and orbital-sandbox were deliberately
// left inlining the same few lines, because CR-3 ("No change to
// graph-array-stepper, trajectory-sandbox, or orbital-sandbox's existing
// config shapes, type guards, or rendering") applied to that build. The
// project owner has since lifted that constraint for the visualization
// improvements in docs/design/visualization-interactions.md (R3 extends the
// trajectory guard; R4 retrofits this helper into both engines). The
// retrofit is behaviour-preserving: it sets the same buffer and CSS sizes,
// scales by the same ratio and clears the same rectangle.
export function setupCanvasForDpr(
  canvas: HTMLCanvasElement,
  widthPx: number,
  heightPx: number,
): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = widthPx * dpr;
  canvas.height = heightPx * dpr;
  canvas.style.width = `${widthPx}px`;
  canvas.style.height = `${heightPx}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, widthPx, heightPx);
  return ctx;
}
