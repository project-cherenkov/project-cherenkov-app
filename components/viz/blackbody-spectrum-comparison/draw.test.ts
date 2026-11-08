import { describe, expect, it } from "vitest";

import { buildScales, drawPlot, layoutFor, DESIGN_HEIGHT, DESIGN_WIDTH } from "./draw";
import type { DrawInput, GraphMode, PlotColors } from "./draw";
import { computeSpectrum, evaluateAt, yAxisLimits } from "./physics-functions";

const COLORS: PlotColors = {
  surface: "SURFACE",
  gridMinor: "GRID_MINOR",
  gridMajor: "GRID_MAJOR",
  axis: "AXIS",
  text: "TEXT",
  mutedText: "MUTED",
  primary: "PRIMARY",
  secondary: "SECONDARY",
  guide: "GUIDE",
};

// A context that records what is stroked and filled, and with which style.
function recordingContext() {
  const state = { strokeStyle: "", fillStyle: "", lineWidth: 1, dash: [] as number[] };
  const strokes: { color: string; width: number; dash: number[] }[] = [];
  const texts: string[] = [];
  const arcs: { fill: string }[] = [];
  const noop = () => undefined;
  const ctx = {
    set strokeStyle(v: string) {
      state.strokeStyle = v;
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set lineWidth(v: number) {
      state.lineWidth = v;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    lineJoin: "miter",
    globalAlpha: 1,
    setLineDash: (d: number[]) => {
      state.dash = d;
    },
    stroke: () => strokes.push({ color: state.strokeStyle, width: state.lineWidth, dash: [...state.dash] }),
    arc: () => arcs.push({ fill: state.fillStyle }),
    fillText: (t: string) => texts.push(t),
    strokeText: noop,
    measureText: (t: string) => ({ width: t.length * 6 }),
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    rect: noop,
    closePath: noop,
    fill: noop,
    fillRect: noop,
    strokeRect: noop,
    clip: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, texts, arcs };
}

function inputFor(over: Partial<DrawInput> & { mode: GraphMode; width?: number; T?: number }): DrawInput {
  const T = over.T ?? 6000;
  const spectrum = computeSpectrum(T);
  return {
    layout: layoutFor(over.width ?? 1000),
    colors: COLORS,
    fontFamily: "sans-serif",
    strings: {
      xTitle: "Wavelength (nm)",
      yTitle: "Spectral radiance per unit wavelength (W m^-3 sr^-1)",
      yTitleShort: "Spectral radiance (W m^-3 sr^-1)",
      planckLabel: "Planck's law",
      rayleighJeansLabel: "Rayleigh–Jeans law",
      peakLabel: "Planck peak",
    },
    spectrum,
    limits: yAxisLimits(spectrum),
    temperatureK: T,
    cursor: evaluateAt(400, T),
    locale: "en",
    ...over,
  };
}

const CURVE_WIDTH = 2.5;
const seriesStrokes = (strokes: { color: string; width: number; dash: number[] }[]) =>
  // The peak marker's outline is also 2.5 wide but card-coloured, so exclude it.
  strokes.filter((s) => s.width === CURVE_WIDTH && s.color !== "SURFACE");

describe("layoutFor", () => {
  it("keeps the 1100 × 690 aspect ratio at every width", () => {
    for (const width of [320, 600, 1000, 1100, 1400]) {
      const layout = layoutFor(width);
      expect(layout.height).toBe(Math.round((width * DESIGN_HEIGHT) / DESIGN_WIDTH));
      expect(layout.width).toBe(width);
    }
  });

  it("reserves gutters for the axis labels, and the plot fits inside the rest", () => {
    for (const width of [320, 600, 1100]) {
      const l = layoutFor(width);
      expect(l.left).toBeGreaterThanOrEqual(62);
      expect(l.bottom).toBeGreaterThanOrEqual(50);
      expect(l.plotWidth).toBeCloseTo(width - l.left - l.right, 6);
      expect(l.plotHeight).toBeCloseTo(l.height - l.top - l.bottom, 6);
      expect(l.plotWidth).toBeGreaterThan(0);
      expect(l.plotHeight).toBeGreaterThan(0);
    }
  });

  it("keeps text a readable size on a phone instead of scaling it down", () => {
    expect(layoutFor(320).fontPx).toBeGreaterThanOrEqual(11);
    expect(layoutFor(1100).fontPx).toBeLessThanOrEqual(15);
  });

  it("never goes negative on a collapsed container", () => {
    const l = layoutFor(0);
    expect(l.plotWidth).toBe(0);
    expect(l.plotHeight).toBeGreaterThanOrEqual(0);
  });
});

describe("buildScales", () => {
  const layout = layoutFor(1000);
  const limits = { minLog10: 6, maxLog10: 18 };
  const scales = buildScales(layout, limits);

  it("maps 100 nm to the left edge and 100,000 nm to the right edge of the plot", () => {
    expect(scales.x(100)).toBeCloseTo(layout.left, 6);
    expect(scales.x(100_000)).toBeCloseTo(layout.left + layout.plotWidth, 6);
  });

  it("is logarithmic: equal ratios are equal distances", () => {
    const decade = scales.x(1000) - scales.x(100);
    expect(scales.x(10_000) - scales.x(1000)).toBeCloseTo(decade, 6);
    expect(scales.x(100_000) - scales.x(10_000)).toBeCloseTo(decade, 6);
    expect(scales.x(316.22776601683796) - scales.x(100)).toBeCloseTo(decade / 2, 6);
  });

  it("inverts the x mapping", () => {
    for (const nm of [100, 250, 483, 5000, 100_000]) {
      expect(scales.xInverse(scales.x(nm)) / nm).toBeCloseTo(1, 9);
    }
  });

  it("puts larger radiance higher up, 10^min at the bottom and 10^max at the top", () => {
    expect(scales.y(1e18)).toBeCloseTo(layout.top, 6);
    expect(scales.y(1e6)).toBeCloseTo(layout.top + layout.plotHeight, 6);
    expect(scales.y(1e12)).toBeLessThan(scales.y(1e10));
  });
});

describe("drawPlot: which curves are drawn", () => {
  it("'planck' draws one solid curve in the primary colour and no dashed line", () => {
    const { ctx, strokes } = recordingContext();
    drawPlot(ctx, inputFor({ mode: "planck" }));
    const curves = seriesStrokes(strokes);
    expect(curves).toEqual([{ color: "PRIMARY", width: CURVE_WIDTH, dash: [] }]);
  });

  it("'rayleigh-jeans' draws one dashed curve in the secondary colour", () => {
    const { ctx, strokes } = recordingContext();
    drawPlot(ctx, inputFor({ mode: "rayleigh-jeans" }));
    const curves = seriesStrokes(strokes);
    expect(curves).toHaveLength(1);
    expect(curves[0]!.color).toBe("SECONDARY");
    expect(curves[0]!.dash.length).toBeGreaterThan(0);
  });

  it("'both' draws the dashed and the solid curve (colour is not the only difference)", () => {
    const { ctx, strokes } = recordingContext();
    drawPlot(ctx, inputFor({ mode: "both" }));
    const curves = seriesStrokes(strokes);
    expect(curves).toHaveLength(2);
    const dashed = curves.find((c) => c.color === "SECONDARY")!;
    const solid = curves.find((c) => c.color === "PRIMARY")!;
    expect(dashed.dash.length).toBeGreaterThan(0);
    expect(solid.dash).toEqual([]);
  });

  it("labels only the curves that are visible, and the peak only with Planck", () => {
    const planck = recordingContext();
    drawPlot(planck.ctx, inputFor({ mode: "planck" }));
    expect(planck.texts).toContain("Planck's law");
    expect(planck.texts).toContain("Planck peak");
    expect(planck.texts).not.toContain("Rayleigh–Jeans law");

    const rj = recordingContext();
    drawPlot(rj.ctx, inputFor({ mode: "rayleigh-jeans" }));
    expect(rj.texts).toContain("Rayleigh–Jeans law");
    expect(rj.texts).not.toContain("Planck's law");
    expect(rj.texts).not.toContain("Planck peak");
  });

  it("draws the Planck peak marker (a circle) only when Planck is visible", () => {
    const planck = recordingContext();
    drawPlot(planck.ctx, inputFor({ mode: "both" }));
    expect(planck.arcs).toEqual([{ fill: "PRIMARY" }]);

    const rj = recordingContext();
    drawPlot(rj.ctx, inputFor({ mode: "rayleigh-jeans" }));
    expect(rj.arcs).toEqual([]);
  });
});

describe("drawPlot: axes and labels", () => {
  it("prints the wavelength titles and the brief's x tick labels on a wide plot", () => {
    const { ctx, texts } = recordingContext();
    drawPlot(ctx, inputFor({ mode: "both", width: 1000 }));
    expect(texts).toContain("Wavelength (nm)");
    for (const label of ["100", "200", "500", "1,000", "2,000", "5,000", "10,000", "20,000", "50,000", "100,000"]) {
      expect(texts).toContain(label);
    }
  });

  it("thins the x labels on a narrow plot but keeps both ends of the axis", () => {
    const { ctx, texts } = recordingContext();
    drawPlot(ctx, inputFor({ mode: "both", width: 340 }));
    expect(texts).toContain("100");
    expect(texts).toContain("100,000");
    expect(texts).not.toContain("200");
    expect(texts).not.toContain("5,000");
  });

  it("leaves out the direct curve labels on a narrow plot (the legend names the curves)", () => {
    const { ctx, texts } = recordingContext();
    drawPlot(ctx, inputFor({ mode: "both", width: 340 }));
    expect(texts).not.toContain("Planck's law");
    expect(texts).not.toContain("Rayleigh–Jeans law");
  });

  it("does nothing, and does not throw, on a collapsed plot", () => {
    const { ctx, strokes } = recordingContext();
    expect(() => drawPlot(ctx, inputFor({ mode: "both", width: 20 }))).not.toThrow();
    expect(strokes).toEqual([]);
  });

  it("uses the same y range in every mode at one temperature", () => {
    const spectrum = computeSpectrum(6000);
    const limits = yAxisLimits(spectrum);
    const ticksFor = (mode: GraphMode) => {
      const { ctx, texts } = recordingContext();
      drawPlot(ctx, inputFor({ mode, spectrum, limits }));
      return texts.filter((t) => t.startsWith("10") && t.length <= 3);
    };
    expect(ticksFor("planck")).toEqual(ticksFor("both"));
    expect(ticksFor("rayleigh-jeans")).toEqual(ticksFor("both"));
  });
});

describe("drawPlot: omitted samples", () => {
  it("skips a null sample instead of throwing or inventing a value", () => {
    const spectrum = computeSpectrum(6000);
    const planck = spectrum.planck.map((v, i) => (i < 5 ? null : v));
    const { ctx } = recordingContext();
    expect(() =>
      drawPlot(ctx, inputFor({ mode: "both", spectrum: { ...spectrum, planck, hasOmittedValues: true } })),
    ).not.toThrow();
  });
});

describe("drawPlot: cursor", () => {
  it("draws a marker on each visible curve, none on a hidden one", () => {
    // The cursor squares/triangles are paths, not arcs: count the extra
    // outline strokes (width 2) around the series strokes.
    const countMarkers = (mode: GraphMode) => {
      const { ctx, strokes } = recordingContext();
      drawPlot(ctx, inputFor({ mode }));
      return strokes.filter((s) => s.width === 2 && s.color === "SURFACE").length;
    };
    // Planck peak circle uses 2.5 (series width) outline; cursor markers use 2.
    expect(countMarkers("both")).toBe(2);
    expect(countMarkers("planck")).toBe(1);
    expect(countMarkers("rayleigh-jeans")).toBe(1);
  });

  it("draws no cursor guide or markers when there is no cursor", () => {
    const { ctx, strokes } = recordingContext();
    drawPlot(ctx, inputFor({ mode: "both", cursor: null }));
    expect(strokes.filter((s) => s.color === "GUIDE")).toEqual([]);
    expect(strokes.filter((s) => s.width === 2 && s.color === "SURFACE")).toEqual([]);
  });
});
