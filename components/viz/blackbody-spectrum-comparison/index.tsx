"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { setupCanvasForDpr } from "@/components/viz/shared/canvas-dpr";
import { readPlotColors } from "./colors";
import { toRuns, toUnicodeSuperscripts } from "./rich-text";
import { buildScales, drawPlot, layoutFor } from "./draw";
import type { GraphMode } from "./draw";
import {
  SAMPLE_COUNT,
  WAVELENGTH_MAX_NM,
  WAVELENGTH_MIN_NM,
  computeSpectrum,
  evaluateAt,
  formatInteger,
  formatScientific,
  formatThreeSignificant,
  planckPeakWavelengthNm,
  yAxisLimits,
} from "./physics-functions";
import {
  initialTemperatureOf,
  temperatureRangeOf,
  temperatureStepOf,
} from "./types";
import type { BlackbodySpectrumComparisonConfig } from "./types";

// Where the cursor starts: the violet end of visible light, where at 6000 K
// the classical curve is already about 67 times too high, and clear of the
// Planck peak marker (483 nm). A reader on a touch screen has no hover, so the
// readout must show something meaningful before any interaction.
const INITIAL_CURSOR_NM = 400;

// One keyboard step is one sample's worth of log wavelength; Shift takes ten.
const LOG_SPAN = Math.log10(WAVELENGTH_MAX_NM) - Math.log10(WAVELENGTH_MIN_NM);
const KEY_STEP_DECADES = LOG_SPAN / (SAMPLE_COUNT - 1);
const SHIFT_MULTIPLIER = 10;

const RADIANCE_UNIT = "W m^-3 sr^-1";

const MODES: GraphMode[] = ["rayleigh-jeans", "planck", "both"];

function clampNm(value: number): number {
  return Math.min(Math.max(value, WAVELENGTH_MIN_NM), WAVELENGTH_MAX_NM);
}

export function BlackbodySpectrumComparison({
  config,
}: {
  config: BlackbodySpectrumComparisonConfig;
}) {
  const t = useTranslations("viz");
  const locale = useLocale();
  const [rangeMin, rangeMax] = temperatureRangeOf(config);
  const step = temperatureStepOf(config);

  const [temperatureK, setTemperatureK] = useState(() => initialTemperatureOf(config));
  const [mode, setMode] = useState<GraphMode>("both");
  const [cursorNm, setCursorNm] = useState(INITIAL_CURSOR_NM);
  // Only keyboard moves are announced; announcing every pointer move would
  // flood a screen reader.
  const [keyboardMoved, setKeyboardMoved] = useState(false);
  const [width, setWidth] = useState(320);
  const [themeVersion, setThemeVersion] = useState(0);

  const ids = useId();
  const descriptionId = `${ids}-description`;
  const modeId = `${ids}-mode`;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The canvas holds resolved colours, not CSS, so a light/dark switch has to
  // trigger a redraw. next-themes toggles the `dark` class on <html>.
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((v) => v + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    return () => observer.disconnect();
  }, []);

  const spectrum = useMemo(() => computeSpectrum(temperatureK), [temperatureK]);
  const limits = useMemo(() => yAxisLimits(spectrum), [spectrum]);
  const cursor = useMemo(() => evaluateAt(cursorNm, temperatureK), [cursorNm, temperatureK]);
  const peakNm = planckPeakWavelengthNm(temperatureK);

  const modeLabels: Record<GraphMode, string> = {
    "rayleigh-jeans": t("blackbodyModeRayleighJeans"),
    planck: t("blackbodyModePlanck"),
    both: t("blackbodyModeBoth"),
  };
  const modePhrase: Record<GraphMode, string> = {
    "rayleigh-jeans": t("blackbodyShowsRayleighJeans"),
    planck: t("blackbodyShowsPlanck"),
    both: t("blackbodyShowsBoth"),
  };

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const layout = layoutFor(width);
    const ctx = setupCanvasForDpr(canvas, layout.width, layout.height);
    if (!ctx) return;
    drawPlot(ctx, {
      layout,
      colors: readPlotColors(canvas),
      fontFamily: getComputedStyle(canvas).fontFamily || "sans-serif",
      strings: {
        xTitle: t("blackbodyXAxis"),
        yTitle: t("blackbodyYAxis"),
        yTitleShort: t("blackbodyYAxisShort"),
        planckLabel: t("blackbodyModePlanck"),
        rayleighJeansLabel: t("blackbodyModeRayleighJeans"),
        peakLabel: t("blackbodyPeakMarker"),
      },
      spectrum,
      limits,
      mode,
      temperatureK,
      cursor,
      locale,
    });
  }, [width, spectrum, limits, mode, temperatureK, cursor, locale, themeVersion, t]);

  function setCursorFromPointer(clientX: number) {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const layout = layoutFor(width);
    const rect = canvas.getBoundingClientRect();
    // The canvas is laid out at `layout.width` CSS pixels; if the browser
    // shows it at another size (page zoom quirks, a transform) map back.
    const pixelX = rect.width > 0 ? ((clientX - rect.left) * layout.width) / rect.width : 0;
    const clamped = Math.min(Math.max(pixelX, layout.left), layout.left + layout.plotWidth);
    setCursorNm(clampNm(buildScales(layout, limits).xInverse(clamped)));
    setKeyboardMoved(false);
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType !== "mouse") e.currentTarget.setPointerCapture?.(e.pointerId);
    setCursorFromPointer(e.clientX);
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    // A mouse hovers; touch and pen only scrub while pressed, so a vertical
    // swipe still scrolls the page (touch-action: pan-y on the canvas).
    if (e.pointerType === "mouse" || e.buttons > 0) setCursorFromPointer(e.clientX);
  }

  function onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    let next: number | null = null;
    const multiplier = e.shiftKey ? SHIFT_MULTIPLIER : 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      next = 10 ** (Math.log10(cursorNm) - KEY_STEP_DECADES * multiplier);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      next = 10 ** (Math.log10(cursorNm) + KEY_STEP_DECADES * multiplier);
    } else if (e.key === "PageDown") {
      next = 10 ** (Math.log10(cursorNm) - KEY_STEP_DECADES * SHIFT_MULTIPLIER);
    } else if (e.key === "PageUp") {
      next = 10 ** (Math.log10(cursorNm) + KEY_STEP_DECADES * SHIFT_MULTIPLIER);
    } else if (e.key === "Home") next = WAVELENGTH_MIN_NM;
    else if (e.key === "End") next = WAVELENGTH_MAX_NM;
    if (next === null) return;
    e.preventDefault();
    setCursorNm(clampNm(next));
    setKeyboardMoved(true);
  }

  // Readout strings. A value that is zero or not finite cannot be shown on the
  // log axis; it reads as a dash and the notice below explains it.
  const sci = (value: number) => (value > 0 ? formatScientific(value) : null);
  const planckText = sci(cursor.planck);
  const rjText = sci(cursor.rayleighJeans);
  const ratioText = sci(cursor.ratio);
  const wavelengthText = formatThreeSignificant(cursor.wavelengthNm, locale);
  const showNotice =
    spectrum.hasOmittedValues || planckText === null || rjText === null || ratioText === null;

  const dash = "—";
  const withUnit = (text: string | null) => (text === null ? dash : `${text} ${RADIANCE_UNIT}`);
  // Spoken form: Unicode superscripts, which screen readers voice as powers.
  const readoutSentence = toUnicodeSuperscripts(
    [
      `${t("blackbodyCursorWavelength")} ${wavelengthText} nm`,
      `${t("blackbodyPlanckRadiance")} ${withUnit(planckText)}`,
      `${t("blackbodyRjRadiance")} ${withUnit(rjText)}`,
      `${t("blackbodyRatio")} ${ratioText ?? dash}`,
    ].join(". "),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:max-w-xs">
        <label htmlFor={modeId} className="label-mono">
          {t("blackbodyGraph")}
        </label>
        <Select
          id={modeId}
          value={mode}
          onChange={(e) => setMode(e.target.value as GraphMode)}
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {modeLabels[m]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <span className="label-mono">
          {t("blackbodyTemperature")}: {formatInteger(temperatureK, locale)} K
        </span>
        <Slider
          aria-label={`${t("blackbodyTemperature")} (K)`}
          min={rangeMin}
          max={rangeMax}
          step={step}
          value={[temperatureK]}
          onValueChange={([v]) => setTemperatureK(v ?? temperatureK)}
        />
        <span className="label-mono">
          {t("blackbodyPeakWavelength")}: {formatInteger(peakNm, locale)} nm
        </span>
      </div>

      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground" aria-label={t("blackbodyLegend")}>
        {(mode === "planck" || mode === "both") && (
          <li className="flex items-center gap-2">
            <svg width="32" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="32" y2="5" strokeWidth="2.5" style={{ stroke: "hsl(var(--brand))" }} />
            </svg>
            {t("blackbodyModePlanck")}
          </li>
        )}
        {(mode === "rayleigh-jeans" || mode === "both") && (
          <li className="flex items-center gap-2">
            <svg width="32" height="10" aria-hidden="true">
              <line
                x1="0"
                y1="5"
                x2="32"
                y2="5"
                strokeWidth="2.5"
                strokeDasharray="7 4"
                style={{ stroke: "hsl(var(--viz-secondary))" }}
              />
            </svg>
            {t("blackbodyModeRayleighJeans")}
          </li>
        )}
        {(mode === "planck" || mode === "both") && (
          <li className="flex items-center gap-2">
            <svg width="12" height="12" aria-hidden="true">
              <circle cx="6" cy="6" r="5" style={{ fill: "hsl(var(--brand))" }} />
            </svg>
            {t("blackbodyPeakMarker")}
          </li>
        )}
      </ul>

      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          className="w-full touch-pan-y rounded-md"
          role="slider"
          tabIndex={0}
          aria-label={t("blackbodyCursorWavelength")}
          aria-describedby={descriptionId}
          aria-orientation="horizontal"
          aria-valuemin={WAVELENGTH_MIN_NM}
          aria-valuemax={WAVELENGTH_MAX_NM}
          aria-valuenow={Math.round(cursorNm)}
          aria-valuetext={readoutSentence}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={onKeyDown}
        />
        <p id={descriptionId} className="sr-only">
          {t("blackbodyAlt", {
            temperature: formatInteger(temperatureK, locale),
            peakWavelength: formatInteger(peakNm, locale),
            mode: modePhrase[mode],
          })}
        </p>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>{t("blackbodyFiniteRangeNote")}</p>
        <p>{t("blackbodyIdealNote")}</p>
        <p>{t("blackbodyCursorHint")}</p>
        {showNotice && (
          <p role="status" className="font-medium text-foreground">
            {t("blackbodyOutOfRange")}
          </p>
        )}
      </div>

      <dl
        className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-live={keyboardMoved ? "polite" : "off"}
      >
        <Readout label={t("blackbodyCursorWavelength")} value={`${wavelengthText} nm`} />
        <Readout label={t("blackbodyPlanckRadiance")} value={withUnit(planckText)} />
        <Readout label={t("blackbodyRjRadiance")} value={withUnit(rjText)} />
        <Readout label={t("blackbodyRatio")} value={ratioText ?? dash} />
      </dl>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label-mono">{label}</dt>
      <dd className="font-mono text-sm text-foreground">
        <Rich text={value} />
      </dd>
    </div>
  );
}

// Exponents as real <sup> elements. A monospace font often has no glyph for
// the Unicode superscripts, so they are not used for display.
function Rich({ text }: { text: string }) {
  return (
    <>
      {toRuns(text).map((run, i) =>
        run.superscript ? <sup key={i}>{run.text}</sup> : <span key={i}>{run.text}</span>,
      )}
    </>
  );
}
