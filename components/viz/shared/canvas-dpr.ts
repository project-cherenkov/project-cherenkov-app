// Small shared helper extracted per SCENE-004 ("shared scale/coordinate
// helpers ... extract these from the existing engines if not already
// factored out"). trajectory-sandbox/index.tsx and orbital-sandbox/index.tsx
// each inline this exact devicePixelRatio + canvas-buffer-size dance
// independently (see trajectory-sandbox/index.tsx's own draw effect);
// composed-scene needs the identical setup, so it's factored out here
// rather than duplicated a third time.
//
// Per CR-3 ("No change to graph-array-stepper, trajectory-sandbox, or
// orbital-sandbox's existing config shapes, type guards, or rendering")
// and the worker instructions' scope discipline, the two existing engines
// are deliberately NOT retrofitted to use this helper — see the
// implementation report's Additional Findings.
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
