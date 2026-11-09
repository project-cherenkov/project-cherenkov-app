"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PlaybackControls } from "@/components/viz/playback-controls";
import { setupCanvasForDpr } from "@/components/viz/shared/canvas-dpr";
import { readSceneColors } from "./colors";
import { drawEarthDay, drawPlanetary, layoutFor } from "./draw";
import type { SceneStrings } from "./draw";
import {
  PHASE_STEP,
  PHASE_STEPS,
  advancePhase,
  clampPhase,
  earthDayState,
  formatFixed,
  formatHms,
  formatSignificant,
  planetaryState,
  radiansToDegrees,
  meanSolarDayDays,
} from "./physics-functions";
import {
  EARTH_ORBIT_PERIOD_RANGE,
  PERIOD_A_RANGE,
  PERIOD_B_RANGE,
  RELATIVE_PERIOD_MODES,
  SIDEREAL_ROTATION_RANGE,
  initialPeriodsOf,
  modeOf,
} from "./types";
import type { PeriodRange, RelativePeriodMode, RelativePeriodSandboxConfig } from "./types";

// Two columns (canvas about 65%, controls about 35%) need room; below this
// container width the canvas stacks above the controls at about 4:3. Measured
// on the instrument itself, not the viewport, because the article column is
// narrower than the screen.
const WIDE_MIN_WIDTH = 880;
// A readout on a facing event counts as "pointing at" within this angle.
const FACING_TOLERANCE_RAD = (0.5 * Math.PI) / 180;

export function RelativePeriodSandbox({ config }: { config: RelativePeriodSandboxConfig }) {
  const t = useTranslations("viz");
  const locale = useLocale();
  const initial = useMemo(() => initialPeriodsOf(config), [config]);

  const [mode, setMode] = useState<RelativePeriodMode>(() => modeOf(config));
  const [siderealRotation, setSiderealRotation] = useState(initial.siderealRotationDays);
  const [earthOrbitPeriod, setEarthOrbitPeriod] = useState(initial.earthOrbitPeriodDays);
  const [periodA, setPeriodA] = useState(initial.periodADays);
  const [periodB, setPeriodB] = useState(initial.periodBDays);
  // Normalised position within one synodic cycle. Always starts paused.
  const [u, setU] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rootWidth, setRootWidth] = useState(320);
  const [canvasWidth, setCanvasWidth] = useState(320);
  const [themeVersion, setThemeVersion] = useState(0);

  const ids = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameRef = useRef<number | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);

  const wide = rootWidth >= WIDE_MIN_WIDTH;

  useEffect(() => {
    const root = rootRef.current;
    const box = canvasBoxRef.current;
    if (!root || !box) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === root) setRootWidth(entry.contentRect.width);
        if (entry.target === box) setCanvasWidth(entry.contentRect.width);
      }
    });
    observer.observe(root);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // The canvas holds resolved colours, so a light/dark switch needs a redraw.
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((v) => v + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    return () => observer.disconnect();
  }, []);

  const earth = useMemo(
    () => earthDayState({ siderealRotationDays: siderealRotation, earthOrbitPeriodDays: earthOrbitPeriod }, u),
    [siderealRotation, earthOrbitPeriod, u],
  );
  const planets = useMemo(
    () => planetaryState({ periodADays: periodA, periodBDays: periodB }, u),
    [periodA, periodB, u],
  );
  const cycleAvailable = mode === "earth-day" ? earth !== null : planets.cycleAvailable;
  const recurrenceDays = mode === "earth-day" ? (earth?.meanSolarDayDays ?? null) : planets.synodicPeriodDays;

  // Playback: linear, 12 s per cycle, holds at the end. Never loops, because
  // the relative configuration repeats but the absolute longitudes do not.
  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = undefined;
      return;
    }
    function frame(now: number) {
      if (lastFrameRef.current === undefined) lastFrameRef.current = now;
      const elapsed = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      setU((prev) => advancePhase(prev, elapsed));
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying && (u >= 1 || !cycleAvailable)) setIsPlaying(false);
  }, [isPlaying, u, cycleAvailable]);

  const strings: SceneStrings = {
    distantStars: t("relativePeriodDistantStars"),
    earthOrientation: t("relativePeriodEarthOrientation"),
    planetaryConfiguration: t("relativePeriodPlanetaryConfiguration"),
    sun: t("relativePeriodSun"),
    earth: t("relativePeriodEarth"),
    earthOrbit: t("relativePeriodEarthOrbit"),
    markedMeridian: t("relativePeriodMarkedMeridian"),
    sunDirection: t("relativePeriodSunDirection"),
    starReference: t("relativePeriodStarReference"),
    orbitA: t("relativePeriodOrbitA"),
    orbitB: t("relativePeriodOrbitB"),
    planetA: t("relativePeriodPlanetA"),
    planetB: t("relativePeriodPlanetB"),
    relativeAngle: t("relativePeriodRelativeAngle"),
    start: t("relativePeriodStart"),
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasWidth <= 0) return;
    const layout = layoutFor(canvasWidth, wide ? "wide" : "narrow");
    const ctx = setupCanvasForDpr(canvas, layout.width, layout.height);
    if (!ctx) return;
    const colors = readSceneColors(canvas);
    const fontFamily = getComputedStyle(canvas).fontFamily || "sans-serif";
    if (mode === "earth-day") {
      if (earth) drawEarthDay(ctx, { layout, colors, fontFamily, strings, state: earth });
    } else {
      drawPlanetary(ctx, { layout, colors, fontFamily, strings, state: planets });
    }
    // `strings` is rebuilt every render from `t`; the locale drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, wide, mode, earth, planets, themeVersion, locale]);

  // ---- Interaction

  function changeMode(next: RelativePeriodMode) {
    setMode(next);
    setU(0);
    setIsPlaying(false);
  }

  function setPhase(next: number) {
    setU(clampPhase(next));
  }

  function onPlayPause() {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (!cycleAvailable) return;
    // Play at the end starts a new cycle from the beginning.
    if (u >= 1) setU(0);
    setIsPlaying(true);
  }

  const scrubValue = Math.round(u * PHASE_STEPS);
  const percent = Math.round(u * 100);

  // ---- Readouts

  const dash = "—";
  const days = (value: number, decimals: number) => `${formatFixed(value, decimals, locale)} d`;
  const degrees = (radians: number) => `${formatFixed(radiansToDegrees(radians), 1, locale)}°`;
  const elapsed =
    recurrenceDays === null
      ? dash
      : `${formatSignificant(u * recurrenceDays, 4, locale)} d`;

  const synodicText =
    mode === "planetary-orbits"
      ? planets.synodicPeriodDays === null
        ? t("relativePeriodNoFiniteSynodic")
        : days(planets.synodicPeriodDays, 3)
      : "";

  const earthTau = meanSolarDayDays({
    siderealRotationDays: siderealRotation,
    earthOrbitPeriodDays: earthOrbitPeriod,
  });
  const facing = (angle: number) =>
    Math.min(angle, 2 * Math.PI - angle) <= FACING_TOLERANCE_RAD;

  const altText = (() => {
    const modeName = mode === "earth-day" ? t("relativePeriodModeEarthDay") : t("relativePeriodModePlanetary");
    const primaryLabel = mode === "earth-day" ? t("relativePeriodSiderealDay") : t("relativePeriodPeriodA");
    const secondaryLabel = mode === "earth-day" ? t("relativePeriodSiderealOrbital") : t("relativePeriodPeriodB");
    const primaryValue = days(mode === "earth-day" ? siderealRotation : periodA, mode === "earth-day" ? 6 : 1);
    const secondaryValue = days(mode === "earth-day" ? earthOrbitPeriod : periodB, mode === "earth-day" ? 4 : 1);
    if (recurrenceDays === null) {
      return t("relativePeriodAltNoCycle", { mode: modeName, primaryLabel, primaryValue, secondaryLabel, secondaryValue });
    }
    return t("relativePeriodAlt", {
      mode: modeName,
      cyclePosition: percent,
      primaryLabel,
      primaryValue,
      secondaryLabel,
      secondaryValue,
      synodicValue: days(recurrenceDays, mode === "earth-day" ? 6 : 3),
    });
  })();

  const columns = wide ? "grid-cols-[minmax(0,13fr)_minmax(0,7fr)]" : "grid-cols-1";

  return (
    <div ref={rootRef} className="flex flex-col gap-4" role="group" aria-label={t("relativePeriodTitle")}>
      <div className={`grid items-start gap-4 ${columns}`}>
        <div className={`flex flex-col gap-1 ${wide ? "col-start-2 row-start-1" : ""}`}>
          <label htmlFor={`${ids}-mode`} className="label-mono">
            {t("relativePeriodMode")}
          </label>
          <Select id={`${ids}-mode`} value={mode} onChange={(e) => changeMode(e.target.value as RelativePeriodMode)}>
            {RELATIVE_PERIOD_MODES.map((m) => (
              <option key={m} value={m}>
                {m === "earth-day" ? t("relativePeriodModeEarthDay") : t("relativePeriodModePlanetary")}
              </option>
            ))}
          </Select>
        </div>

        <div ref={canvasBoxRef} className={`min-w-0 ${wide ? "col-start-1 row-span-2 row-start-1" : ""}`}>
          <canvas ref={canvasRef} className="w-full rounded-md" role="img" aria-label={altText} />
        </div>

        <div className={`flex min-w-0 flex-col gap-4 ${wide ? "col-start-2 row-start-2" : ""}`}>
          {mode === "earth-day" ? (
            <>
              <PeriodSlider
                id={`${ids}-rot`}
                label={t("relativePeriodSiderealRotation")}
                symbol="τ*"
                value={siderealRotation}
                range={SIDEREAL_ROTATION_RANGE}
                text={days(siderealRotation, 6)}
                onChange={setSiderealRotation}
              />
              <PeriodSlider
                id={`${ids}-orb`}
                label={t("relativePeriodEarthOrbitPeriod")}
                symbol="P"
                value={earthOrbitPeriod}
                range={EARTH_ORBIT_PERIOD_RANGE}
                text={days(earthOrbitPeriod, 4)}
                onChange={setEarthOrbitPeriod}
              />
            </>
          ) : (
            <>
              <PeriodSlider
                id={`${ids}-a`}
                label={t("relativePeriodPeriodA")}
                symbol="P_A"
                value={periodA}
                range={PERIOD_A_RANGE}
                text={days(periodA, 1)}
                onChange={setPeriodA}
              />
              <PeriodSlider
                id={`${ids}-b`}
                label={t("relativePeriodPeriodB")}
                symbol="P_B"
                value={periodB}
                range={PERIOD_B_RANGE}
                text={days(periodB, 1)}
                onChange={setPeriodB}
              />
            </>
          )}

          {mode === "earth-day" && earth && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setIsPlaying(false); setPhase(earth.siderealReturnPhase); }}>
                  {t("relativePeriodJumpSidereal")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setIsPlaying(false); setPhase(1); }}>
                  {t("relativePeriodJumpSolar")}
                </Button>
              </div>
              <ul className="flex flex-col gap-1 text-xs text-foreground">
                <li>
                  {facing(earth.meridianToStar) ? "✓ " : "○ "}
                  {t("relativePeriodFacingStar")}
                </li>
                <li>
                  {facing(earth.meridianToSun) ? "✓ " : "○ "}
                  {t("relativePeriodFacingSun")}
                </li>
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-border pt-3" aria-live={isPlaying ? "off" : "polite"}>
            {mode === "earth-day" ? (
              <>
                <Readout label={t("relativePeriodSiderealDay")} value={`${days(siderealRotation, 6)} (${formatHms(siderealRotation, locale)})`} />
                <Readout label={t("relativePeriodEarthOrbitPeriod")} value={days(earthOrbitPeriod, 4)} />
                <Readout
                  label={t("relativePeriodMeanSolarDay")}
                  value={earthTau === null ? dash : `${days(earthTau, 6)} (${formatHms(earthTau, locale)})`}
                />
                <Readout
                  label={t("relativePeriodOrbitalAdvance")}
                  value={earth ? `${formatFixed(earth.orbitalAdvanceDegrees, 4, locale)}°` : dash}
                />
                <Readout label={t("relativePeriodMeridianToSun")} value={earth ? degrees(earth.meridianToSun) : dash} />
              </>
            ) : (
              <>
                <Readout label={t("relativePeriodPeriodA")} value={days(periodA, 1)} />
                <Readout label={t("relativePeriodPeriodB")} value={days(periodB, 1)} />
                <Readout label={t("relativePeriodSynodic")} value={synodicText} />
                <Readout label={t("relativePeriodRelativeSeparation")} value={degrees(planets.relativeAngle)} />
              </>
            )}
            <Readout label={t("relativePeriodElapsed")} value={elapsed} />
          </dl>

          {mode === "planetary-orbits" && !planets.cycleAvailable && (
            <p role="status" className="text-sm font-medium text-foreground">
              {t("relativePeriodNoFiniteSynodic")}. {t("relativePeriodNoChange")}.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>{t("relativePeriodSchematic")}</p>
        {mode === "earth-day" && <p>{t("relativePeriodApparentNote")}</p>}
      </div>

      <PlaybackControls
        current={scrubValue}
        total={PHASE_STEPS}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        onStep={(dir) => {
          setIsPlaying(false);
          setPhase(u + dir * PHASE_STEP);
        }}
        onScrub={(v) => {
          setIsPlaying(false);
          setPhase(v / PHASE_STEPS);
        }}
        onReset={() => {
          setIsPlaying(false);
          setU(0);
        }}
        label={`${t("relativePeriodCyclePosition")}: ${percent}%`}
      />
    </div>
  );
}

function PeriodSlider({
  id,
  label,
  symbol,
  value,
  range,
  text,
  onChange,
}: {
  id: string;
  label: string;
  symbol: string;
  value: number;
  range: PeriodRange;
  text: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label-mono">
        {label} ({symbol}): {text}
      </label>
      <Slider
        id={id}
        aria-label={`${label} (d)`}
        min={range.min}
        max={range.max}
        step={range.step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
      />
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label-mono">{label}</dt>
      <dd className="font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}
