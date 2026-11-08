// Canvas drawing for the blackbody-spectrum-comparison plot. Kept apart from
// the React component so the geometry is plain functions and the drawing can
// be exercised against a recording context in tests (and rendered to a PNG
// while developing). D3 is used for scales only, as everywhere in this repo.
import { scaleLinear } from "d3";

import {
  WAVELENGTH_MAX_NM,
  WAVELENGTH_MIN_NM,
  X_DECADE_TICKS_NM,
  X_MAJOR_TICKS_NM,
  formatInteger,
  formatPowerOfTen,
  planckPeakWavelengthNm,
  planckRadiance,
  nmToM,
  xMinorGridNm,
  yDecades,
  yLabelStepDecades,
} from "./physics-functions";
import type { CursorValues, Spectrum, YAxisLimits } from "./physics-functions";
import { rayleighJeansRadiance } from "./physics-functions";
import { toRuns } from "./rich-text";
import type { TextRun } from "./rich-text";

export type GraphMode = "rayleigh-jeans" | "planck" | "both";

// The design size from the brief. The canvas is drawn at the container's real
// pixel width with this aspect ratio, so text stays at a readable pixel size
// on a phone instead of shrinking with the plot.
export const DESIGN_WIDTH = 1100;
export const DESIGN_HEIGHT = 690;

export interface PlotLayout {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  plotWidth: number;
  plotHeight: number;
  fontPx: number;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

export function layoutFor(widthPx: number): PlotLayout {
  const scale = widthPx / DESIGN_WIDTH;
  const height = Math.round((widthPx * DESIGN_HEIGHT) / DESIGN_WIDTH);
  const fontPx = clamp(14 * scale, 11, 15);
  const left = clamp(110 * scale, 62, 110);
  const right = clamp(24 * scale, 14, 24);
  const top = clamp(20 * scale, 10, 20);
  const bottom = clamp(66 * scale, 50, 66);
  return {
    width: widthPx,
    height,
    left,
    right,
    top,
    bottom,
    plotWidth: Math.max(widthPx - left - right, 0),
    plotHeight: Math.max(height - top - bottom, 0),
    fontPx,
  };
}

export interface PlotScales {
  x: (wavelengthNm: number) => number;
  xInverse: (pixelX: number) => number; // → wavelength in nm
  y: (value: number) => number;
}

// Axis mapping happens in log10 coordinates, never by interpolating linearly
// in wavelength.
export function buildScales(layout: PlotLayout, limits: YAxisLimits): PlotScales {
  const xLinear = scaleLinear()
    .domain([Math.log10(WAVELENGTH_MIN_NM), Math.log10(WAVELENGTH_MAX_NM)])
    .range([layout.left, layout.left + layout.plotWidth]);
  const yLinear = scaleLinear()
    .domain([limits.minLog10, limits.maxLog10])
    .range([layout.top + layout.plotHeight, layout.top]);
  return {
    x: (nm) => xLinear(Math.log10(nm)),
    xInverse: (px) => 10 ** xLinear.invert(px),
    y: (value) => yLinear(Math.log10(value)),
  };
}

export interface PlotColors {
  surface: string;
  gridMinor: string;
  gridMajor: string;
  axis: string;
  text: string;
  mutedText: string;
  primary: string;
  secondary: string;
  guide: string;
}

export interface PlotStrings {
  xTitle: string;
  yTitle: string;
  yTitleShort: string;
  planckLabel: string;
  rayleighJeansLabel: string;
  peakLabel: string;
}

export interface DrawInput {
  layout: PlotLayout;
  colors: PlotColors;
  fontFamily: string;
  strings: PlotStrings;
  spectrum: Spectrum;
  limits: YAxisLimits;
  mode: GraphMode;
  temperatureK: number;
  cursor: CursorValues | null;
  locale: string;
}

const MIN_PLOT_PX = 40;

export function drawPlot(ctx: CanvasRenderingContext2D, input: DrawInput): void {
  const { layout, colors, spectrum, limits, mode, temperatureK, cursor } = input;
  if (layout.plotWidth < MIN_PLOT_PX || layout.plotHeight < MIN_PLOT_PX) return;
  const scales = buildScales(layout, limits);
  const showPlanck = mode === "planck" || mode === "both";
  const showRj = mode === "rayleigh-jeans" || mode === "both";
  const plot = {
    x: layout.left,
    y: layout.top,
    w: layout.plotWidth,
    h: layout.plotHeight,
  };
  const bottomY = plot.y + plot.h;

  // Plot background.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(plot.x, plot.y, plot.w, plot.h);

  drawGrid(ctx, input, scales);

  // Frame.
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.strokeRect(plot.x + 0.5, plot.y + 0.5, plot.w - 1, plot.h - 1);

  drawTickLabels(ctx, input, scales);
  drawAxisTitles(ctx, input);

  // Everything data-driven is clipped to the plotting rectangle.
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.w, plot.h);
  ctx.clip();

  if (cursor) {
    const cx = scales.x(cursor.wavelengthNm);
    ctx.strokeStyle = colors.guide;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx, plot.y);
    ctx.lineTo(cx, bottomY);
    ctx.stroke();
  }

  if (showRj) {
    strokeSeries(ctx, spectrum.wavelengthsNm, spectrum.rayleighJeans, scales, {
      color: colors.secondary,
      dash: [10, 6],
    });
  }
  if (showPlanck) {
    strokeSeries(ctx, spectrum.wavelengthsNm, spectrum.planck, scales, {
      color: colors.primary,
      dash: [],
    });
  }
  ctx.setLineDash([]);

  // Planck peak marker (a circle) at λ_max, y from Equation (2).
  let peak: { x: number; y: number } | null = null;
  if (showPlanck) {
    const peakNm = planckPeakWavelengthNm(temperatureK);
    const peakValue = planckRadiance(nmToM(peakNm), temperatureK);
    if (
      peakNm >= WAVELENGTH_MIN_NM &&
      peakNm <= WAVELENGTH_MAX_NM &&
      isPlottable(peakValue)
    ) {
      peak = { x: scales.x(peakNm), y: scales.y(peakValue) };
      ctx.fillStyle = colors.primary;
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(peak.x, peak.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // Cursor point markers: a square on Planck, a triangle on Rayleigh–Jeans,
  // so the two are told apart by shape and not by colour alone.
  if (cursor) {
    const cx = scales.x(cursor.wavelengthNm);
    if (showPlanck && isPlottable(cursor.planck)) {
      drawSquare(ctx, cx, scales.y(cursor.planck), 5.5, colors.primary, colors.surface);
    }
    if (showRj && isPlottable(cursor.rayleighJeans)) {
      drawTriangle(ctx, cx, scales.y(cursor.rayleighJeans), 7, colors.secondary, colors.surface);
    }
  }

  ctx.restore();

  drawDirectLabels(ctx, input, scales, peak, { showPlanck, showRj });
}

function isPlottable(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function strokeSeries(
  ctx: CanvasRenderingContext2D,
  wavelengthsNm: number[],
  values: (number | null)[],
  scales: PlotScales,
  style: { color: string; dash: number[] },
) {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.setLineDash(style.dash);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < wavelengthsNm.length; i++) {
    const v = values[i];
    // A sample that cannot sit on a log axis is skipped; the line runs on
    // between the finite neighbours and no value is invented.
    if (v === null || v === undefined) continue;
    const px = scales.x(wavelengthsNm[i]!);
    const py = scales.y(v);
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGrid(ctx: CanvasRenderingContext2D, input: DrawInput, scales: PlotScales) {
  const { layout, colors, limits } = input;
  const top = layout.top;
  const bottom = layout.top + layout.plotHeight;
  const left = layout.left;
  const right = layout.left + layout.plotWidth;
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  ctx.setLineDash([]);

  const decadeCount = limits.maxLog10 - limits.minLog10;
  const pxPerDecade = layout.plotHeight / Math.max(decadeCount, 1e-9);
  const labelStep = yLabelStepDecades(pxPerDecade, layout.fontPx * 2.2);

  // Lighter subdivisions where legibility allows: 2..9 × 10^n on y once a
  // decade is tall enough, 2..9 × 10^d on x always (a decade is wide).
  ctx.strokeStyle = colors.gridMinor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  for (const nm of xMinorGridNm()) {
    const px = Math.round(scales.x(nm)) + 0.5;
    line(px, top, px, bottom);
  }
  if (pxPerDecade >= 48) {
    for (const n of yDecades({ minLog10: limits.minLog10 - 1, maxLog10: limits.maxLog10 })) {
      for (let k = 2; k <= 9; k++) {
        const py = scales.y(k * 10 ** n);
        if (py > top && py < bottom) line(left, Math.round(py) + 0.5, right, Math.round(py) + 0.5);
      }
    }
  }
  ctx.globalAlpha = 0.7;
  // Every decade on y that is not a labelled major line.
  if (pxPerDecade >= 6) {
    for (const n of yDecades(limits)) {
      if (n % labelStep === 0) continue;
      const py = Math.round(scales.y(10 ** n)) + 0.5;
      line(left, py, right, py);
    }
  }

  // Major grid: the labelled x ticks and the labelled y decades.
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.gridMajor;
  for (const nm of X_DECADE_TICKS_NM) {
    const px = Math.round(scales.x(nm)) + 0.5;
    line(px, top, px, bottom);
  }
  for (const n of yDecades(limits)) {
    if (n % labelStep !== 0) continue;
    const py = Math.round(scales.y(10 ** n)) + 0.5;
    line(left, py, right, py);
  }
}

// Tick label thinning on narrow plots: the axis range and the logarithmic
// scale never change, only how many labels are printed.
const NARROW_PLOT_PX = 520;

function drawTickLabels(ctx: CanvasRenderingContext2D, input: DrawInput, scales: PlotScales) {
  const { layout, colors, limits, locale } = input;
  const bottom = layout.top + layout.plotHeight;
  ctx.fillStyle = colors.mutedText;
  ctx.font = `${layout.fontPx}px ${input.fontFamily}`;

  // x: wavelength ticks at their exact logarithmic positions.
  ctx.textBaseline = "top";
  const ticks = layout.plotWidth < NARROW_PLOT_PX ? X_DECADE_TICKS_NM : X_MAJOR_TICKS_NM;
  for (const nm of ticks) {
    const px = scales.x(nm);
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(px) + 0.5, bottom);
    ctx.lineTo(Math.round(px) + 0.5, bottom + 4);
    ctx.stroke();
    // Keep the first and last label inside the canvas.
    ctx.textAlign = nm === WAVELENGTH_MIN_NM ? "left" : nm === WAVELENGTH_MAX_NM ? "right" : "center";
    const anchor =
      nm === WAVELENGTH_MIN_NM ? px - 4 : nm === WAVELENGTH_MAX_NM ? px + 4 : px;
    ctx.fillText(formatInteger(nm, locale), anchor, bottom + 7);
  }

  // y: powers of ten, thinned to a legible step.
  ctx.textBaseline = "middle";
  const decadeCount = limits.maxLog10 - limits.minLog10;
  const pxPerDecade = layout.plotHeight / Math.max(decadeCount, 1e-9);
  const labelStep = yLabelStepDecades(pxPerDecade, layout.fontPx * 2.2);
  for (const n of yDecades(limits)) {
    if (n % labelStep !== 0) continue;
    const py = scales.y(10 ** n);
    ctx.strokeStyle = colors.axis;
    ctx.beginPath();
    ctx.moveTo(layout.left - 4, Math.round(py) + 0.5);
    ctx.lineTo(layout.left, Math.round(py) + 0.5);
    ctx.stroke();
    drawRich(ctx, formatPowerOfTen(n), layout.left - 7, py + layout.fontPx * 0.15, "right", layout.fontPx, input.fontFamily);
  }
}

function drawAxisTitles(ctx: CanvasRenderingContext2D, input: DrawInput) {
  const { layout, colors, strings } = input;
  ctx.fillStyle = colors.text;
  ctx.font = `${layout.fontPx}px ${input.fontFamily}`;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    strings.xTitle,
    layout.left + layout.plotWidth / 2,
    layout.height - Math.max(5, layout.fontPx * 0.35),
  );

  // y title, rotated. The full title is used when it fits the plot's height
  // at a legible size, otherwise the short one. Text is never squeezed.
  const family = input.fontFamily;
  const maxWidth = layout.plotHeight;
  const fits = (text: string, size: number) =>
    richWidth(ctx, toRuns(text), size, family) <= maxWidth;
  let size = layout.fontPx;
  let title = strings.yTitle;
  if (!fits(title, size)) {
    size = Math.max(10, layout.fontPx - 1);
    if (!fits(title, size)) {
      title = strings.yTitleShort;
      size = Math.max(10, layout.fontPx - 1);
    }
  }
  ctx.save();
  ctx.translate(Math.max(size, 12), layout.top + layout.plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.text;
  drawRich(ctx, title, 0, 0, "center", size, family);
  ctx.restore();
}

// Direct labels sit where each curve leaves free space: the Planck label under
// the curve to the right of its peak, the Rayleigh–Jeans label above the line
// near the right edge. Both are placed from the curves' own values so they
// clear the line, and a card-coloured halo keeps them legible over grid lines.
// On a narrow plot they are left out: the legend above the plot names the
// curves, and the labels would sit on top of each other.
const DIRECT_LABEL_MIN_PLOT_PX = 520;

function drawDirectLabels(
  ctx: CanvasRenderingContext2D,
  input: DrawInput,
  scales: PlotScales,
  peak: { x: number; y: number } | null,
  visible: { showPlanck: boolean; showRj: boolean },
) {
  const { layout, colors, strings, spectrum, temperatureK } = input;
  if (layout.plotWidth < DIRECT_LABEL_MIN_PLOT_PX) return;
  const plotRight = layout.left + layout.plotWidth;
  const plotTop = layout.top;
  const plotBottom = layout.top + layout.plotHeight;
  const size = layout.fontPx;
  const family = input.fontFamily;
  const halo = { color: colors.surface, width: 4 };
  ctx.lineJoin = "round";
  ctx.textBaseline = "alphabetic";
  const widthOf = (text: string) => richWidth(ctx, toRuns(text), size, family, "600");
  const paint = (text: string, x: number, y: number, color: string, align: "left" | "center" | "right") => {
    ctx.fillStyle = color;
    drawRich(ctx, text, x, y, align, size, family, { weight: "600", halo });
  };

  if (visible.showRj) {
    // Above the dashed line, at the label's own left end (the line falls to
    // the right, so that is where it is highest).
    const labelWidth = widthOf(strings.rayleighJeansLabel);
    const leftX = plotRight - 8 - labelWidth;
    const lineY = scales.y(rayleighJeansRadiance(nmToM(scales.xInverse(leftX)), temperatureK));
    const y = Math.max(lineY - 12, plotTop + size + 2);
    paint(strings.rayleighJeansLabel, plotRight - 8, y, colors.secondary, "right");
  }
  if (visible.showPlanck) {
    // Below the solid line, at the label's own right end (the line falls to
    // the right, so that is where it is lowest).
    const i = spectrum.wavelengthsNm.findIndex((nm) => nm >= 3000);
    const v = i >= 0 ? spectrum.planck[i] : null;
    if (v !== null && v !== undefined) {
      const x = scales.x(spectrum.wavelengthsNm[i]!);
      const rightNm = scales.xInverse(x + widthOf(strings.planckLabel));
      const rightY = scales.y(planckRadiance(nmToM(rightNm), temperatureK));
      const y = Math.min(Math.max(scales.y(v), rightY) + size + 12, plotBottom - 8);
      paint(strings.planckLabel, x, y, colors.primary, "left");
    }
    if (peak) {
      const y = Math.min(peak.y + size + 14, plotBottom - 8);
      paint(strings.peakLabel, peak.x, y, colors.primary, "center");
    }
  }
}

function drawSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  half: number,
  fill: string,
  outline: string,
) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - half, y - half, half * 2, half * 2);
  ctx.fill();
  ctx.stroke();
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  outline: string,
) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y + size * 0.8);
  ctx.lineTo(x - size, y + size * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// --- Rich text (exponents) on canvas --------------------------------------

const SUPERSCRIPT_SCALE = 0.72;
const SUPERSCRIPT_RISE = 0.4;

function richWidth(ctx: CanvasRenderingContext2D, runs: TextRun[], fontPx: number, family: string, weight = "") {
  let total = 0;
  for (const run of runs) {
    const size = run.superscript ? fontPx * SUPERSCRIPT_SCALE : fontPx;
    ctx.font = `${weight} ${size}px ${family}`.trim();
    total += ctx.measureText(run.text).width;
  }
  return total;
}

// Draws runs on one baseline with exponents smaller and raised. Alignment is
// done here (by measuring), so the context's textAlign is left at "left".
function drawRich(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: "left" | "center" | "right",
  fontPx: number,
  family: string,
  options: { weight?: string; halo?: { color: string; width: number } } = {},
) {
  const runs = toRuns(text);
  const weight = options.weight ?? "";
  const width = richWidth(ctx, runs, fontPx, family, weight);
  const start = align === "left" ? x : align === "center" ? x - width / 2 : x - width;
  ctx.textAlign = "left";
  for (const pass of options.halo ? ["halo", "fill"] : ["fill"]) {
    let penX = start;
    for (const run of runs) {
      const size = run.superscript ? fontPx * SUPERSCRIPT_SCALE : fontPx;
      ctx.font = `${weight} ${size}px ${family}`.trim();
      const runY = run.superscript ? y - fontPx * SUPERSCRIPT_RISE : y;
      if (pass === "halo" && options.halo) {
        ctx.lineWidth = options.halo.width;
        ctx.strokeStyle = options.halo.color;
        ctx.strokeText(run.text, penX, runY);
      } else {
        ctx.fillText(run.text, penX, runY);
      }
      penX += ctx.measureText(run.text).width;
    }
  }
  return width;
}
