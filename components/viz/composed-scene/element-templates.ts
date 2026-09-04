import { themeColors } from "@/lib/theme-colors";

// Named-template registry — same reason vizConfig can't hold real render
// code as trajectory-sandbox's PHYSICS_FUNCTIONS (see that file's own
// comment): frontmatter is static YAML/JSON, so a SceneElement picks a
// template by `templateId` and supplies bounded params, rather than
// shipping a literal render function. Adding a template later means adding
// one entry here — never a schema or Keystatic change (spec §5).
//
// FR-2 constraint: every param is a number, a small bounded select, a
// boolean, or short plain text (a caption/label) — never a freeform
// code/expression field. "text" is included as its own ParamType distinct
// from a hypothetical formula/expression field: it is always treated as
// literal display text (see text-label below), never evaluated, so it does
// not reopen the freeform-logic door Decision A closes. Curve *shape* is
// still chosen from a closed set of templates (curve-linear/quadratic/
// sine/points), never an arbitrary formula string.

export type ParamType = "number" | "boolean" | "select" | "text";

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  default: number | string | boolean;
  min?: number; // number
  max?: number; // number
  step?: number; // number — form increment
  options?: readonly string[]; // select
  maxLength?: number; // text — keeps it bounded, not freeform
}

export type ResolvedParams = Record<string, number | string | boolean>;

// Design-space -> actual-render-space coordinate mapping. Elements are
// authored against the scene's declared canvas.widthPx/heightPx (a fixed
// "design" size); ComposedScene (SCENE-005) derives a single uniform scale
// factor from the ResizeObserver-driven container width, the same
// "one scale factor applied to both x and y" approach
// trajectory-sandbox/index.tsx's own toPx() already uses (its `scale`
// variable), just generalized so any template can use it without knowing
// the container's real-time width itself.
export interface ScaleFns {
  x: (designX: number) => number;
  y: (designY: number) => number;
  length: (designLength: number) => number;
}

export interface ElementTemplate {
  id: string;
  label: string;
  paramSchema: ParamSpec[];
  render: (
    ctx: CanvasRenderingContext2D,
    params: ResolvedParams,
    scale: ScaleFns,
  ) => void;
}

const COLOR_OPTIONS = ["blue", "blueAlt", "pink", "pinkAlt", "grid"] as const;

function resolveColor(value: unknown): string {
  const key = typeof value === "string" ? value : "blue";
  return (themeColors as Record<string, string>)[key] ?? themeColors.blue;
}

function num(params: ResolvedParams, key: string, fallback = 0): number {
  const v = params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(params: ResolvedParams, key: string, fallback = ""): string {
  const v = params[key];
  return typeof v === "string" ? v : fallback;
}

// --- static shapes (A-2: "static shape (circle/rect/line/arrow)") ---
// Implemented as four separate registry entries rather than one "shape"
// template with a kind selector: each entry gets its own clean, minimal
// paramSchema (no dead fields per kind), and it matches the "drag a
// template from the palette" mental model more directly — a contributor
// picks the circle card, not a generic shape card plus a kind dropdown.
// This is a template-*granularity* choice, not a data-model requirement;
// A-2 itself treats "growing the set later" as purely additive, so this
// reads four cards instead of one is within that same latitude.

const shapeCircle: ElementTemplate = {
  id: "shape-circle",
  label: "Circle",
  paramSchema: [
    { key: "x", label: "X", type: "number", default: 60, min: 0, max: 1000, step: 1 },
    { key: "y", label: "Y", type: "number", default: 60, min: 0, max: 1000, step: 1 },
    { key: "radius", label: "Radius", type: "number", default: 20, min: 1, max: 300, step: 1 },
    { key: "color", label: "Color", type: "select", default: "blue", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    ctx.fillStyle = resolveColor(params.color);
    ctx.beginPath();
    ctx.arc(
      scale.x(num(params, "x", 60)),
      scale.y(num(params, "y", 60)),
      scale.length(num(params, "radius", 20)),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  },
};

const shapeRect: ElementTemplate = {
  id: "shape-rect",
  label: "Rectangle",
  paramSchema: [
    { key: "x", label: "X", type: "number", default: 40, min: 0, max: 1000, step: 1 },
    { key: "y", label: "Y", type: "number", default: 40, min: 0, max: 1000, step: 1 },
    { key: "width", label: "Width", type: "number", default: 60, min: 1, max: 600, step: 1 },
    { key: "height", label: "Height", type: "number", default: 40, min: 1, max: 600, step: 1 },
    { key: "color", label: "Color", type: "select", default: "blue", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    ctx.fillStyle = resolveColor(params.color);
    ctx.fillRect(
      scale.x(num(params, "x", 40)),
      scale.y(num(params, "y", 40)),
      scale.length(num(params, "width", 60)),
      scale.length(num(params, "height", 40)),
    );
  },
};

const shapeLine: ElementTemplate = {
  id: "shape-line",
  label: "Line",
  paramSchema: [
    { key: "x1", label: "X1", type: "number", default: 20, min: 0, max: 1000, step: 1 },
    { key: "y1", label: "Y1", type: "number", default: 60, min: 0, max: 1000, step: 1 },
    { key: "x2", label: "X2", type: "number", default: 140, min: 0, max: 1000, step: 1 },
    { key: "y2", label: "Y2", type: "number", default: 60, min: 0, max: 1000, step: 1 },
    { key: "color", label: "Color", type: "select", default: "grid", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    ctx.strokeStyle = resolveColor(params.color);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scale.x(num(params, "x1", 20)), scale.y(num(params, "y1", 60)));
    ctx.lineTo(scale.x(num(params, "x2", 140)), scale.y(num(params, "y2", 60)));
    ctx.stroke();
  },
};

const shapeArrow: ElementTemplate = {
  id: "shape-arrow",
  label: "Arrow",
  paramSchema: [
    { key: "x1", label: "X1", type: "number", default: 20, min: 0, max: 1000, step: 1 },
    { key: "y1", label: "Y1", type: "number", default: 60, min: 0, max: 1000, step: 1 },
    { key: "x2", label: "X2", type: "number", default: 140, min: 0, max: 1000, step: 1 },
    { key: "y2", label: "Y2", type: "number", default: 60, min: 0, max: 1000, step: 1 },
    { key: "color", label: "Color", type: "select", default: "blue", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    const x1 = scale.x(num(params, "x1", 20));
    const y1 = scale.y(num(params, "y1", 60));
    const x2 = scale.x(num(params, "x2", 140));
    const y2 = scale.y(num(params, "y2", 60));
    const color = resolveColor(params.color);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  },
};

// --- text label (A-2) ---
// Content is drawn directly onto the Canvas 2D surface via ctx.fillText —
// it deliberately does NOT get the A-4 Markdown/KaTeX treatment the way
// SceneStep.note does. KaTeX renders to DOM (HTML+CSS), and there is no
// existing, in-scope path from that to canvas pixels short of rasterizing
// to an offscreen image per draw — a real feature in its own right that
// nothing else in this spec hints at building, and one Decision A's
// "smallest coherent change" framing argues against adding here. See the
// implementation report's Deviations section.
const textLabel: ElementTemplate = {
  id: "text-label",
  label: "Text label",
  paramSchema: [
    { key: "x", label: "X", type: "number", default: 40, min: 0, max: 1000, step: 1 },
    { key: "y", label: "Y", type: "number", default: 30, min: 0, max: 1000, step: 1 },
    { key: "text", label: "Text", type: "text", default: "Label", maxLength: 60 },
    { key: "color", label: "Color", type: "select", default: "grid", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    ctx.fillStyle = resolveColor(params.color);
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      str(params, "text", "Label").slice(0, 60),
      scale.x(num(params, "x", 40)),
      scale.y(num(params, "y", 30)),
    );
  },
};

// --- plotted curves (A-2: "linear / quadratic / sine / custom point-list —
// no freeform formula") ---
// Each curve kind is parametrized so its coefficients stay in a small,
// sensible numeric range regardless of the domain's pixel width: quadratic
// and sine work over a normalized t = (x - domainMinPx) / (domainMaxPx -
// domainMinPx) rather than raw pixel x, so "a", "b", "c" mean "roughly this
// many px of amplitude" instead of blowing up with x^2 in real px units.

function drawSampledCurve(
  ctx: CanvasRenderingContext2D,
  scale: ScaleFns,
  domainMinPx: number,
  domainMaxPx: number,
  color: string,
  f: (xPx: number) => number,
) {
  const samples = 60;
  const lo = Math.min(domainMinPx, domainMaxPx);
  const hi = Math.max(domainMinPx, domainMaxPx);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = lo + ((hi - lo) * i) / samples;
    const px = scale.x(x);
    const py = scale.y(f(x));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

const DOMAIN_PARAMS: ParamSpec[] = [
  { key: "domainMinPx", label: "Domain min (X)", type: "number", default: 20, min: 0, max: 1000, step: 1 },
  { key: "domainMaxPx", label: "Domain max (X)", type: "number", default: 280, min: 0, max: 1000, step: 1 },
];

const curveLinear: ElementTemplate = {
  id: "curve-linear",
  label: "Curve — linear",
  paramSchema: [
    ...DOMAIN_PARAMS,
    { key: "slope", label: "Slope", type: "number", default: 0.5, min: -5, max: 5, step: 0.05 },
    { key: "intercept", label: "Y at domain min", type: "number", default: 60, min: -500, max: 500, step: 1 },
    { key: "color", label: "Color", type: "select", default: "blue", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    const domainMinPx = num(params, "domainMinPx", 20);
    const domainMaxPx = num(params, "domainMaxPx", 280);
    const slope = num(params, "slope", 0.5);
    const intercept = num(params, "intercept", 60);
    drawSampledCurve(ctx, scale, domainMinPx, domainMaxPx, resolveColor(params.color), (x) => intercept + slope * (x - domainMinPx));
  },
};

const curveQuadratic: ElementTemplate = {
  id: "curve-quadratic",
  label: "Curve — quadratic",
  paramSchema: [
    ...DOMAIN_PARAMS,
    { key: "a", label: "a (t² coefficient)", type: "number", default: -80, min: -500, max: 500, step: 1 },
    { key: "b", label: "b (t coefficient)", type: "number", default: 80, min: -500, max: 500, step: 1 },
    { key: "c", label: "c (baseline)", type: "number", default: 40, min: -500, max: 500, step: 1 },
    { key: "color", label: "Color", type: "select", default: "pink", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    const domainMinPx = num(params, "domainMinPx", 20);
    const domainMaxPx = num(params, "domainMaxPx", 280);
    const a = num(params, "a", -80);
    const b = num(params, "b", 80);
    const c = num(params, "c", 40);
    const span = domainMaxPx - domainMinPx || 1;
    drawSampledCurve(ctx, scale, domainMinPx, domainMaxPx, resolveColor(params.color), (x) => {
      const t = (x - domainMinPx) / span;
      return a * t * t + b * t + c;
    });
  },
};

const curveSine: ElementTemplate = {
  id: "curve-sine",
  label: "Curve — sine",
  paramSchema: [
    ...DOMAIN_PARAMS,
    { key: "amplitude", label: "Amplitude", type: "number", default: 30, min: 0, max: 300, step: 1 },
    { key: "frequency", label: "Frequency (cycles across domain)", type: "number", default: 2, min: 0.25, max: 8, step: 0.25 },
    { key: "phaseDeg", label: "Phase (degrees)", type: "number", default: 0, min: 0, max: 360, step: 5 },
    { key: "baseline", label: "Baseline (Y)", type: "number", default: 80, min: -500, max: 500, step: 1 },
    { key: "color", label: "Color", type: "select", default: "blueAlt", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    const domainMinPx = num(params, "domainMinPx", 20);
    const domainMaxPx = num(params, "domainMaxPx", 280);
    const amplitude = num(params, "amplitude", 30);
    const frequency = num(params, "frequency", 2);
    const phaseDeg = num(params, "phaseDeg", 0);
    const baseline = num(params, "baseline", 80);
    const span = domainMaxPx - domainMinPx || 1;
    drawSampledCurve(ctx, scale, domainMinPx, domainMaxPx, resolveColor(params.color), (x) => {
      const t = (x - domainMinPx) / span;
      return baseline + amplitude * Math.sin(2 * Math.PI * frequency * t + (phaseDeg * Math.PI) / 180);
    });
  },
};

// "custom point-list" (A-2), bounded to a fixed 2–4 points rather than a
// truly arbitrary-length list: FR-2 requires typed, bounded parameters, and
// a variable-length list doesn't fit a flat paramSchema the same way a
// fixed set of numeric fields does. This is the same kind of conservative,
// documented narrowing keystatic.config.ts's own `pointers` field comment
// already applies to graph-array-stepper's open Record<string, number> —
// capped at a generous-but-bounded size (4 points) consistent with A-3's
// whole capping philosophy, extendable later (e.g. a "curve-points-8"
// template) the same additive way any other registry growth works.
const curvePoints: ElementTemplate = {
  id: "curve-points",
  label: "Curve — point list",
  paramSchema: [
    { key: "pointCount", label: "Number of points", type: "select", default: "2", options: ["2", "3", "4"] },
    { key: "p1x", label: "Point 1 — X", type: "number", default: 20, min: 0, max: 1000, step: 1 },
    { key: "p1y", label: "Point 1 — Y", type: "number", default: 100, min: 0, max: 1000, step: 1 },
    { key: "p2x", label: "Point 2 — X", type: "number", default: 100, min: 0, max: 1000, step: 1 },
    { key: "p2y", label: "Point 2 — Y", type: "number", default: 40, min: 0, max: 1000, step: 1 },
    { key: "p3x", label: "Point 3 — X", type: "number", default: 180, min: 0, max: 1000, step: 1 },
    { key: "p3y", label: "Point 3 — Y", type: "number", default: 100, min: 0, max: 1000, step: 1 },
    { key: "p4x", label: "Point 4 — X", type: "number", default: 260, min: 0, max: 1000, step: 1 },
    { key: "p4y", label: "Point 4 — Y", type: "number", default: 40, min: 0, max: 1000, step: 1 },
    { key: "color", label: "Color", type: "select", default: "blue", options: COLOR_OPTIONS },
  ],
  render: (ctx, params, scale) => {
    const pointCount = Math.min(Math.max(parseInt(str(params, "pointCount", "2"), 10) || 2, 2), 4);
    const points: { x: number; y: number }[] = [];
    for (let i = 1; i <= pointCount; i++) {
      points.push({ x: num(params, `p${i}x`, 0), y: num(params, `p${i}y`, 0) });
    }
    ctx.strokeStyle = resolveColor(params.color);
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const px = scale.x(p.x);
      const py = scale.y(p.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  },
};

// --- slider-bound marker (A-2) ---
// Functionally the same drawable shape as shape-circle, but registered
// separately so the palette carries an explicit "this is the one you bind
// a slider to" card, matching A-2's own listing of it as its own template.
// Any element's param CAN be bound via SceneControl.bindsTo — this template
// is just the canonical, purpose-built one for that job, sized and colored
// like a marker (small, pink-alt fill + blue-alt stroke) rather than a
// generic shape, matching the fill+stroke marker style
// trajectory-sandbox/orbital-sandbox already use for their own moving
// markers.
const sliderMarker: ElementTemplate = {
  id: "slider-marker",
  label: "Slider-bound marker",
  paramSchema: [
    { key: "x", label: "X", type: "number", default: 60, min: 0, max: 1000, step: 1 },
    { key: "y", label: "Y", type: "number", default: 60, min: 0, max: 1000, step: 1 },
    { key: "radius", label: "Radius", type: "number", default: 8, min: 2, max: 60, step: 1 },
  ],
  render: (ctx, params, scale) => {
    const x = scale.x(num(params, "x", 60));
    const y = scale.y(num(params, "y", 60));
    const r = scale.length(num(params, "radius", 8));
    ctx.fillStyle = themeColors.pinkAlt;
    ctx.strokeStyle = themeColors.blueAlt;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },
};

// --- array-with-pointers (A-2, adapted from graph-array-stepper) ---
// graph-array-stepper's own array/pointers are genuinely open-ended (an
// arbitrary-length array; pointers is an open Record<string, number> — see
// that engine's types.ts comment). FR-2 disallows unbounded/freeform
// params, so this template applies the same conservative, documented
// narrowing keystatic.config.ts's `pointers` field already applies for
// Keystatic authoring: a fixed cap of 8 cells (activeCount picks how many
// are shown) and 3 named pointers. The visual language (rounded cells,
// highlighted fill, mono value text, pointer labels above) is ported from
// graph-array-stepper/index.tsx's SVG rendering into equivalent Canvas 2D
// draw calls — SDR-1's "reuse, don't reimplement" spirit applied to
// rendering, not a literal function reuse, since composed-scene's runtime
// is Canvas 2D (NFR-2) while graph-array-stepper renders SVG. See the
// implementation report's Deviations section.
const ARRAY_CELL_WIDTH = 32;
const ARRAY_CELL_HEIGHT = 28;
const ARRAY_TEXT_COLOR = "#0f172a"; // slate-900, matches graph-array-stepper's fill-slate-900
const ARRAY_LABEL_COLOR = "#64748b"; // slate-500, matches its fill-slate-500

const arrayPointers: ElementTemplate = {
  id: "array-pointers",
  label: "Array with pointers",
  paramSchema: [
    { key: "x", label: "X (top-left)", type: "number", default: 20, min: 0, max: 1000, step: 1 },
    { key: "y", label: "Y (top-left)", type: "number", default: 40, min: 0, max: 1000, step: 1 },
    { key: "activeCount", label: "Cells", type: "select", default: "5", options: ["1", "2", "3", "4", "5", "6", "7", "8"] },
    { key: "cell1", label: "Cell 1", type: "number", default: 2, min: -999, max: 999, step: 1 },
    { key: "cell2", label: "Cell 2", type: "number", default: 4, min: -999, max: 999, step: 1 },
    { key: "cell3", label: "Cell 3", type: "number", default: 6, min: -999, max: 999, step: 1 },
    { key: "cell4", label: "Cell 4", type: "number", default: 8, min: -999, max: 999, step: 1 },
    { key: "cell5", label: "Cell 5", type: "number", default: 10, min: -999, max: 999, step: 1 },
    { key: "cell6", label: "Cell 6", type: "number", default: 12, min: -999, max: 999, step: 1 },
    { key: "cell7", label: "Cell 7", type: "number", default: 14, min: -999, max: 999, step: 1 },
    { key: "cell8", label: "Cell 8", type: "number", default: 16, min: -999, max: 999, step: 1 },
    { key: "pointerCount", label: "Pointers", type: "select", default: "1", options: ["0", "1", "2", "3"] },
    { key: "pointer1Label", label: "Pointer 1 label", type: "text", default: "i", maxLength: 6 },
    { key: "pointer1Index", label: "Pointer 1 index", type: "number", default: 0, min: 0, max: 7, step: 1 },
    { key: "pointer2Label", label: "Pointer 2 label", type: "text", default: "j", maxLength: 6 },
    { key: "pointer2Index", label: "Pointer 2 index", type: "number", default: 2, min: 0, max: 7, step: 1 },
    { key: "pointer3Label", label: "Pointer 3 label", type: "text", default: "k", maxLength: 6 },
    { key: "pointer3Index", label: "Pointer 3 index", type: "number", default: 4, min: 0, max: 7, step: 1 },
    { key: "highlightIndex", label: "Highlighted index (-1 = none)", type: "number", default: -1, min: -1, max: 7, step: 1 },
  ],
  render: (ctx, params, scale) => {
    const originX = num(params, "x", 20);
    const originY = num(params, "y", 40);
    const activeCount = Math.min(Math.max(parseInt(str(params, "activeCount", "5"), 10) || 5, 1), 8);
    const pointerCount = Math.min(Math.max(parseInt(str(params, "pointerCount", "1"), 10) || 0, 0), 3);
    const highlightIndex = num(params, "highlightIndex", -1);

    const pointersByIndex = new Map<number, string[]>();
    for (let p = 1; p <= pointerCount; p++) {
      const idx = num(params, `pointer${p}Index`, 0);
      const label = str(params, `pointer${p}Label`, "");
      if (!label) continue;
      const list = pointersByIndex.get(idx) ?? [];
      list.push(label);
      pointersByIndex.set(idx, list);
    }

    for (let i = 0; i < activeCount; i++) {
      const cellValue = num(params, `cell${i + 1}`, 0);
      const cellX = scale.x(originX + i * ARRAY_CELL_WIDTH);
      const cellY = scale.y(originY);
      const w = scale.length(ARRAY_CELL_WIDTH - 4);
      const h = scale.length(ARRAY_CELL_HEIGHT);
      const isHighlighted = i === highlightIndex;

      ctx.fillStyle = isHighlighted ? themeColors.blue : "#ffffff";
      ctx.strokeStyle = isHighlighted ? themeColors.blueAlt : themeColors.grid;
      ctx.lineWidth = isHighlighted ? 2 : 1;
      const r = Math.min(6, w / 4, h / 4);
      drawRoundedRect(ctx, cellX, cellY, w, h, r);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ARRAY_TEXT_COLOR;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(cellValue), cellX + w / 2, cellY + h / 2);

      const labels = pointersByIndex.get(i);
      if (labels && labels.length > 0) {
        ctx.fillStyle = ARRAY_LABEL_COLOR;
        ctx.font = "10px monospace";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(labels.join("/").toUpperCase(), cellX + w / 2, cellY - 4);
      }
    }
  },
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export const ELEMENT_TEMPLATES: Record<string, ElementTemplate> = {
  "shape-circle": shapeCircle,
  "shape-rect": shapeRect,
  "shape-line": shapeLine,
  "shape-arrow": shapeArrow,
  "text-label": textLabel,
  "curve-linear": curveLinear,
  "curve-quadratic": curveQuadratic,
  "curve-sine": curveSine,
  "curve-points": curvePoints,
  "slider-marker": sliderMarker,
  "array-pointers": arrayPointers,
};

export const ELEMENT_TEMPLATE_KEYS = Object.keys(ELEMENT_TEMPLATES);
