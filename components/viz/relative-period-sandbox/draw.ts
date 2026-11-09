// Canvas drawing for the relative-period-sandbox engine. Kept apart from the
// React component so the geometry is plain functions and the drawing can be
// exercised against a recording context in tests (and rendered to a PNG while
// developing). The drawing is schematic: radii and sizes are design units, not
// kilometres or astronomical units, and are not derived from Kepler's third
// law.
import { TWO_PI, polarToCanvas } from "./physics-functions";
import type { EarthDayState, PlanetaryState } from "./physics-functions";

// Two design spaces. "wide" is the brief's 1200 × 720 (about 5:3) with the
// orbit diagram and the orientation dial side by side. "narrow" is about 4:3
// and stacks them, for a phone or any container too narrow for two columns.
export type LayoutKind = "wide" | "narrow";

export const WIDE_DESIGN = { width: 1200, height: 720 } as const;
export const NARROW_DESIGN = { width: 1000, height: 750 } as const;

export interface SceneLayout {
  kind: LayoutKind;
  width: number;
  height: number;
  scale: number; // CSS pixels per design unit
  fontPx: number;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

export function layoutFor(widthPx: number, kind: LayoutKind): SceneLayout {
  const design = kind === "wide" ? WIDE_DESIGN : NARROW_DESIGN;
  const scale = widthPx / design.width;
  return {
    kind,
    width: widthPx,
    height: Math.round(scale * design.height),
    scale,
    // Text keeps a readable pixel size instead of shrinking with the diagram.
    fontPx: clamp(23 * scale, 11, 16),
  };
}

export interface SceneColors {
  surface: string;
  grid: string;
  text: string;
  mutedText: string;
  primary: string;
  secondary: string;
}

export interface SceneStrings {
  distantStars: string;
  earthOrientation: string;
  planetaryConfiguration: string;
  sun: string;
  earth: string;
  earthOrbit: string;
  markedMeridian: string;
  sunDirection: string;
  starReference: string;
  orbitA: string;
  orbitB: string;
  planetA: string;
  planetB: string;
  relativeAngle: string;
  start: string;
}

// ------------------------------------------------------------------ Geometry

interface Point {
  x: number;
  y: number;
}

// All in design units, from the brief.
const EARTH_DAY_GEOMETRY = {
  wide: { sun: { x: 230, y: 360 }, orbitRadius: 165, dial: { x: 850, y: 360 }, dialRadius: 145 },
  narrow: { sun: { x: 500, y: 195 }, orbitRadius: 135, dial: { x: 500, y: 575 }, dialRadius: 120 },
} as const;

const PLANETARY_GEOMETRY = {
  wide: { sun: { x: 300, y: 360 }, radiusA: 135, radiusB: 255 },
  narrow: { sun: { x: 500, y: 385 }, radiusA: 160, radiusB: 300 },
} as const;

// Fixed marks for the distant-star field, kept in the margins clear of both
// diagrams and their labels.
const STAR_FIELD: Record<LayoutKind, readonly Point[]> = {
  wide: [
    { x: 70, y: 95 }, { x: 175, y: 140 }, { x: 300, y: 85 }, { x: 430, y: 135 },
    { x: 570, y: 80 }, { x: 690, y: 135 }, { x: 800, y: 75 }, { x: 930, y: 105 },
    { x: 1050, y: 70 }, { x: 1140, y: 140 }, { x: 90, y: 640 }, { x: 240, y: 685 },
    { x: 390, y: 630 }, { x: 550, y: 675 }, { x: 700, y: 640 }, { x: 860, y: 685 },
    { x: 1010, y: 645 }, { x: 1140, y: 610 },
  ],
  narrow: [
    { x: 80, y: 90 }, { x: 170, y: 250 }, { x: 70, y: 380 }, { x: 905, y: 110 },
    { x: 840, y: 290 }, { x: 935, y: 410 }, { x: 75, y: 715 }, { x: 930, y: 720 },
    { x: 250, y: 705 }, { x: 760, y: 700 }, { x: 55, y: 540 }, { x: 950, y: 590 },
  ],
};

// ------------------------------------------------------------------- Helpers

type Ctx = CanvasRenderingContext2D;

interface Frame {
  ctx: Ctx;
  layout: SceneLayout;
  colors: SceneColors;
  font: string; // CSS font family
}

const toPx = (layout: SceneLayout, units: number) => units * layout.scale;

function setFont(f: Frame, sizeScale = 1, weight = "") {
  f.ctx.font = `${weight ? `${weight} ` : ""}${Math.max(10, f.layout.fontPx * sizeScale)}px ${f.font}`;
}

function strokeCircle(f: Frame, cx: number, cy: number, r: number, color: string, width: number, dash: number[] = []) {
  const { ctx } = f;
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TWO_PI);
  ctx.stroke();
  ctx.restore();
}

function fillCircle(f: Frame, cx: number, cy: number, r: number, fill: string, outline: string, outlineWidth = 2) {
  const { ctx } = f;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = outlineWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TWO_PI);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function line(f: Frame, a: Point, b: Point, color: string, width: number, dash: number[] = []) {
  const { ctx } = f;
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

// A filled triangle at `tip`, pointing along the direction (dx, dy).
function arrowHead(f: Frame, tip: Point, dx: number, dy: number, size: number, color: string) {
  const { ctx } = f;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - ux * size - uy * size * 0.5, tip.y - uy * size + ux * size * 0.5);
  ctx.lineTo(tip.x - ux * size + uy * size * 0.5, tip.y - uy * size - ux * size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export type TextAlign = "left" | "right" | "center";

// Text with a halo in the surface colour so it stays legible over lines.
function text(f: Frame, value: string, x: number, y: number, align: TextAlign, color: string, weight = "") {
  const { ctx } = f;
  setFont(f, 1, weight);
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = f.colors.surface;
  ctx.strokeText(value, x, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}

export interface LabelItem {
  anchor: Point; // where the thing being labelled is
  y: number; // where the label wants to sit vertically
  text: string;
}

// Spreads labels that would sit on top of one another: sorted by y, each is
// pushed down until it is at least `minGap` below the one above, then the
// whole cluster is re-centred on where it started. Returns the new y values in
// the input order.
export function spreadLabels(wanted: number[], minGap: number): number[] {
  const order = wanted.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((entry) => entry.y);
  for (let i = 1; i < placed.length; i++) {
    placed[i] = Math.max(placed[i]!, placed[i - 1]! + minGap);
  }
  const shift =
    order.reduce((sum, entry) => sum + entry.y, 0) / order.length -
    placed.reduce((sum, y) => sum + y, 0) / placed.length;
  const result = new Array<number>(wanted.length);
  order.forEach((entry, k) => {
    result[entry.i] = placed[k]! + shift;
  });
  return result;
}

// An arc of radius r, centred (cx, cy), from math angle `from` counter-
// clockwise through `sweep` radians, with an arrowhead at the far end. Math
// angles run counterclockwise with y up; the canvas is y-down, so every angle
// is negated.
function arcWithArrow(
  f: Frame,
  cx: number,
  cy: number,
  r: number,
  from: number,
  sweep: number,
  color: string,
  headSize: number,
) {
  const { ctx } = f;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, -from, -(from + sweep), true);
  ctx.stroke();
  ctx.restore();
  const end = from + sweep;
  const tip = polarToCanvas(cx, cy, r, end);
  // Counterclockwise tangent, in canvas coordinates.
  arrowHead(f, tip, -Math.sin(end), -Math.cos(end), headSize, color);
}

// Below this the arc and its label would be a speck; the readout still shows
// the angle.
const MIN_ARC_SWEEP = 0.03;

// Distant-star marks: a short plus, fixed in the canvas frame.
function drawStars(f: Frame) {
  const { ctx, layout } = f;
  const arm = Math.max(3, toPx(layout, 7));
  ctx.save();
  ctx.strokeStyle = f.colors.mutedText;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.5;
  for (const p of STAR_FIELD[layout.kind]) {
    const x = toPx(layout, p.x);
    const y = toPx(layout, p.y);
    ctx.beginPath();
    ctx.moveTo(x - arm, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm);
    ctx.lineTo(x, y + arm);
    ctx.stroke();
  }
  ctx.restore();
}

// -------------------------------------------------------------- Earth's day

export interface EarthDayScene {
  layout: SceneLayout;
  colors: SceneColors;
  fontFamily: string;
  strings: SceneStrings;
  state: EarthDayState;
}

export function drawEarthDay(ctx: Ctx, scene: EarthDayScene): void {
  const { layout, colors, strings, state } = scene;
  const f: Frame = { ctx, layout, colors, font: scene.fontFamily };
  const g = EARTH_DAY_GEOMETRY[layout.kind];
  const px = (n: number) => toPx(layout, n);

  // Distant stars: the fixed reference.
  drawStars(f);
  const starLabel = layout.kind === "wide" ? { x: 30, y: 38 } : { x: 30, y: 30 };
  text(f, strings.distantStars, px(starLabel.x), px(starLabel.y), "left", colors.mutedText);

  // Orbit diagram.
  const sx = px(g.sun.x);
  const sy = px(g.sun.y);
  const orbitR = px(g.orbitRadius);
  strokeCircle(f, sx, sy, orbitR, colors.grid, 1.75);
  fillCircle(f, sx, sy, px(26), colors.primary, colors.text, 2);
  text(f, strings.sun, sx, sy + px(26) + layout.fontPx * 1.1, "center", colors.text);
  text(f, strings.earthOrbit, sx, sy + orbitR + layout.fontPx * 1.6, "center", colors.mutedText);

  const earth = polarToCanvas(sx, sy, orbitR, state.orbitAngle);
  fillCircle(f, earth.x, earth.y, Math.max(5, px(11)), colors.primary, colors.text, 2);
  // The label sits on the outside of the orbit, away from the Sun.
  const earthOut = polarToCanvas(sx, sy, orbitR + Math.max(14, px(26)), state.orbitAngle);
  text(
    f,
    strings.earth,
    earthOut.x,
    earthOut.y,
    Math.cos(state.orbitAngle) >= 0 ? "left" : "right",
    colors.text,
    "600",
  );

  // Orientation dial.
  const dx = px(g.dial.x);
  const dy = px(g.dial.y);
  const dialR = px(g.dialRadius);
  ctx.save();
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(dx, dy, dialR, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
  strokeCircle(f, dx, dy, dialR, colors.grid, 2);
  for (let k = 0; k < 12; k++) {
    const a = polarToCanvas(dx, dy, dialR * 0.93, (k * TWO_PI) / 12);
    const b = polarToCanvas(dx, dy, dialR, (k * TWO_PI) / 12);
    line(f, a, b, colors.grid, 1.25);
  }
  fillCircle(f, dx, dy, Math.max(3, px(7)), colors.surface, colors.mutedText, 1.5);
  text(f, strings.earthOrientation, dx, dy - dialR - layout.fontPx * 1.7, "center", colors.text, "600");

  // The "Start" mark: the shared direction at time zero, fixed on the rim.
  const startOuter = polarToCanvas(dx, dy, dialR + px(14), state.starAngle);
  const startInner = polarToCanvas(dx, dy, dialR - px(14), state.starAngle);
  line(f, startInner, startOuter, colors.text, 3.5);

  // Rays, longest to shortest so the shorter ones stay visible when they
  // coincide at time zero.
  const starTip = polarToCanvas(dx, dy, dialR * 1.32, state.starAngle);
  const sunTip = polarToCanvas(dx, dy, dialR * 1.16, state.sunAngle);
  const meridianTip = polarToCanvas(dx, dy, dialR, state.meridianAngle);
  const centre = { x: dx, y: dy };
  line(f, centre, starTip, colors.mutedText, 2, [2, 5]); // dotted
  line(f, centre, sunTip, colors.primary, 3.5); // solid
  arrowHead(f, sunTip, sunTip.x - dx, sunTip.y - dy, Math.max(8, px(18)), colors.primary);
  line(f, centre, meridianTip, colors.secondary, 3, [9, 5]); // dashed
  fillCircle(f, meridianTip.x, meridianTip.y, Math.max(4, px(9)), colors.secondary, colors.surface, 2);

  // Direct labels at the ray tips. The three coincide at time zero, so their
  // heights are spread apart and a short leader joins each to its tip.
  const items = [
    { tip: starTip, angle: state.starAngle, text: strings.starReference, color: colors.mutedText, weight: "" },
    { tip: sunTip, angle: state.sunAngle, text: strings.sunDirection, color: colors.primary, weight: "600" },
    { tip: meridianTip, angle: state.meridianAngle, text: strings.markedMeridian, color: colors.secondary, weight: "600" },
  ];
  const gap = layout.fontPx * 1.45;
  const ys = spreadLabels(items.map((item) => item.tip.y), gap);
  items.forEach((item, i) => {
    const right = Math.cos(item.angle) >= 0;
    const labelX = item.tip.x + (right ? 1 : -1) * Math.max(8, px(14));
    const labelY = ys[i]!;
    if (Math.abs(labelY - item.tip.y) > 2) {
      line(f, item.tip, { x: labelX - (right ? 2 : -2), y: labelY }, item.color, 1);
    }
    text(f, item.text, labelX, labelY, right ? "left" : "right", item.color, item.weight);
  });

  // "Start" label, inside the rim beside its mark.
  text(f, strings.start, dx - dialR + px(20), dy + layout.fontPx * 1.6, "left", colors.text, "600");

  // Relative-angle arc: from the Sun direction, counterclockwise, to the
  // meridian.
  if (state.meridianToSun > MIN_ARC_SWEEP) {
    const arcR = dialR * 0.55;
    arcWithArrow(f, dx, dy, arcR, state.sunAngle, state.meridianToSun, colors.text, Math.max(7, px(15)));
    // Below the dial, not on the arc: a near-full turn would cover any label
    // placed inside it.
    text(f, strings.relativeAngle, dx, dy + dialR + layout.fontPx * 1.7, "center", colors.text);
  }
}

// ---------------------------------------------------------- Planetary orbits

export interface PlanetaryScene {
  layout: SceneLayout;
  colors: SceneColors;
  fontFamily: string;
  strings: SceneStrings;
  state: PlanetaryState;
}

export function drawPlanetary(ctx: Ctx, scene: PlanetaryScene): void {
  const { layout, colors, strings, state } = scene;
  const f: Frame = { ctx, layout, colors, font: scene.fontFamily };
  const g = PLANETARY_GEOMETRY[layout.kind];
  const px = (n: number) => toPx(layout, n);

  const sx = px(g.sun.x);
  const sy = px(g.sun.y);
  const rA = px(g.radiusA);
  const rB = px(g.radiusB);

  text(f, strings.planetaryConfiguration, px(30), px(layout.kind === "wide" ? 38 : 34), "left", colors.mutedText, "600");

  // Orbits: A solid, B dashed, so they differ by pattern as well as by label.
  strokeCircle(f, sx, sy, rA, colors.grid, 1.75);
  strokeCircle(f, sx, sy, rB, colors.grid, 1.75, [9, 6]);
  const labelAngle = (2 * Math.PI) / 3;
  const orbitALabel = polarToCanvas(sx, sy, rA + px(24), labelAngle);
  const orbitBLabel = polarToCanvas(sx, sy, rB + px(24), labelAngle);
  text(f, strings.orbitA, orbitALabel.x, orbitALabel.y, "center", colors.mutedText);
  text(f, strings.orbitB, orbitBLabel.x, orbitBLabel.y, "center", colors.mutedText);

  // "Start": the longitude both bodies leave from, fixed in the canvas.
  const startFrom = polarToCanvas(sx, sy, px(34), 0);
  const startTo = polarToCanvas(sx, sy, rB + px(26), 0);
  line(f, startFrom, startTo, colors.text, 2, [3, 5]);
  text(f, strings.start, startTo.x + px(8), startTo.y - layout.fontPx * 0.2, "left", colors.text, "600");

  // Sun.
  fillCircle(f, sx, sy, px(24), colors.primary, colors.text, 2);
  text(f, strings.sun, sx, sy + px(24) + layout.fontPx * 1.1, "center", colors.text);

  const a = polarToCanvas(sx, sy, rA, state.longitudeA);
  const b = polarToCanvas(sx, sy, rB, state.longitudeB);
  line(f, { x: sx, y: sy }, a, colors.mutedText, 1.5);
  line(f, { x: sx, y: sy }, b, colors.mutedText, 1.5, [2, 4]);

  // Relative angle: from B's direction, counterclockwise, to A's.
  if (state.cycleAvailable && state.relativeAngle > MIN_ARC_SWEEP) {
    const arcR = rA * 0.5;
    arcWithArrow(f, sx, sy, arcR, state.longitudeB, state.relativeAngle, colors.text, Math.max(7, px(15)));
    const mid = state.longitudeB + state.relativeAngle / 2;
    const at = polarToCanvas(sx, sy, arcR + px(26), mid);
    text(f, strings.relativeAngle, at.x, at.y, "center", colors.text);
  }

  // Markers: A a filled circle, B a filled circle with a second ring.
  fillCircle(f, a.x, a.y, Math.max(5, px(11)), colors.primary, colors.text, 2);
  fillCircle(f, b.x, b.y, Math.max(5, px(12)), colors.secondary, colors.text, 2);
  strokeCircle(f, b.x, b.y, Math.max(8, px(19)), colors.secondary, 2);

  const outA = polarToCanvas(sx, sy, rA + px(30), state.longitudeA);
  const outB = polarToCanvas(sx, sy, rB + px(34), state.longitudeB);
  const labels = [
    { p: outA, angle: state.longitudeA, text: strings.planetA, color: colors.primary },
    { p: outB, angle: state.longitudeB, text: strings.planetB, color: colors.secondary },
  ];
  const ys = spreadLabels(labels.map((l) => l.p.y), layout.fontPx * 1.45);
  labels.forEach((l, i) => {
    text(f, l.text, l.p.x, ys[i]!, Math.cos(l.angle) >= 0 ? "left" : "right", l.color, "600");
  });
}
