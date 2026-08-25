"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PlaybackControls } from "@/components/viz/playback-controls";
import { Slider } from "@/components/ui/slider";
import type { OrbitalSandboxConfig } from "./types";

const SCRUB_STEPS = 200;
const CANVAS_HEIGHT = 220;
const LIGHT_CURVE_HEIGHT = 64;
const PADDING_PX = 20;
// Schematic angular half-width (in eccentric anomaly, radians) of the
// star's disc as seen from the planet at periapsis. Not derived from real
// stellar/planet radii — this sandbox doesn't model those — chosen so the
// transit dip is comfortably visible across the eccentricity range.
const TRANSIT_ANGULAR_HALF_WIDTH = 0.22;

// Kepler's equation M = E - e sin(E), solved for E via Newton–Raphson.
function solveEccentricAnomaly(meanAnomaly: number, e: number): number {
  let E = meanAnomaly;
  for (let i = 0; i < 8; i++) {
    E = E - (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
  }
  return E;
}

export function OrbitalSandbox({ config }: { config: OrbitalSandboxConfig }) {
  const t = useTranslations("viz");
  const massRatioDefault = config.massRatio ?? 0.05;
  const transitDepth = config.transitDepth ?? 0.01;

  const [eccentricity, setEccentricity] = useState(config.eccentricity);
  const [massRatio, setMassRatio] = useState(massRatioDefault);
  const [simTime, setSimTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [width, setWidth] = useState(320);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(undefined);
  const lastFrameRef = useRef<number>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Orbit is periodic — unlike the trajectory sandbox, playback loops
  // instead of stopping at the end.
  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = undefined;
      return;
    }
    function frame(now: number) {
      if (lastFrameRef.current === undefined) lastFrameRef.current = now;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      setSimTime((prev) => (prev + dt) % config.periodSeconds);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, config.periodSeconds]);

  const a = config.semiMajorAxisPx;
  const b = a * Math.sqrt(1 - eccentricity ** 2);
  const c = a * eccentricity;
  const meanMotion = (2 * Math.PI) / config.periodSeconds;

  function planetOffsetAt(time: number) {
    const M = meanMotion * time;
    const E = solveEccentricAnomaly(M, eccentricity);
    // Position relative to the focus the star sits at.
    return { x: a * Math.cos(E) - c, y: b * Math.sin(E) };
  }

  // Simplified transit model: assumes the transit is periapsis-aligned
  // (a common simplifying convention in intro problems) and viewed
  // edge-on. Real transit timing/duration also depends on argument of
  // periapsis, impact parameter, and inclination — none of which this
  // sandbox models. What IS physically real here: transit duration
  // shrinking as eccentricity grows, because the planet moves fastest
  // near periapsis (Kepler's second law) — dM/dE = 1 − e·cos(E).
  const transitHalfWidthSeconds =
    (TRANSIT_ANGULAR_HALF_WIDTH * (1 - eccentricity) * config.periodSeconds) /
    (2 * Math.PI);

  function fluxAt(time: number) {
    const distToPeriapsis = Math.min(time, config.periodSeconds - time);
    if (distToPeriapsis > transitHalfWidthSeconds) return 1;
    const x = distToPeriapsis / transitHalfWidthSeconds;
    const dipShape = 0.5 * (1 + Math.cos(Math.PI * x)); // smooth ingress/egress
    return 1 - transitDepth * dipShape;
  }

  const lightCurve = useMemo(() => {
    const samples = 160;
    return Array.from({ length: samples + 1 }, (_, i) => {
      const time = (config.periodSeconds * i) / samples;
      return { time, flux: fluxAt(time) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eccentricity, transitDepth, config.periodSeconds, transitHalfWidthSeconds]);

  // Draw orbit + star + planet.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, CANVAS_HEIGHT);

    const fit = Math.min(
      (width - PADDING_PX * 2) / (2 * a),
      (CANVAS_HEIGHT - PADDING_PX * 2) / (2 * b),
      1,
    );
    const cx = width / 2;
    const cy = CANVAS_HEIGHT / 2;

    const planetOffset = planetOffsetAt(simTime);
    const starOffset = { x: -massRatio * planetOffset.x, y: -massRatio * planetOffset.y };

    // Orbit ellipse (centered on the barycenter at canvas center).
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, a * fit, b * fit, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Star.
    ctx.fillStyle = "#FFC8E6";
    ctx.beginPath();
    ctx.arc(cx + starOffset.x * fit, cy + starOffset.y * fit, 9, 0, Math.PI * 2);
    ctx.fill();

    // Planet.
    ctx.fillStyle = "#5BCEFA";
    ctx.strokeStyle = "#8AD7FF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + planetOffset.x * fit, cy + planetOffset.y * fit, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, simTime, eccentricity, massRatio, a, b, c, meanMotion]);

  const scrubValue = Math.round((simTime / config.periodSeconds) * SCRUB_STEPS);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SliderField
          label={`e = ${eccentricity.toFixed(2)}`}
          value={eccentricity}
          min={config.eccentricityRange?.[0] ?? 0}
          max={config.eccentricityRange?.[1] ?? 0.85}
          step={0.01}
          onChange={setEccentricity}
        />
        <SliderField
          label={`M_planet / M_star ≈ ${massRatio.toFixed(3)}`}
          value={massRatio}
          min={config.massRatioRange?.[0] ?? 0}
          max={config.massRatioRange?.[1] ?? 0.2}
          step={0.005}
          onChange={setMassRatio}
        />
      </div>

      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      <div>
        <p className="label-code mb-1">{t("transitCurve")}</p>
        <svg width={width} height={LIGHT_CURVE_HEIGHT} className="w-full">
          <polyline
            fill="none"
            stroke="#8AD7FF"
            strokeWidth={2}
            points={lightCurve
              .map((p, i) => {
                const x = (i / (lightCurve.length - 1)) * width;
                const y =
                  LIGHT_CURVE_HEIGHT * 0.15 +
                  (1 - (p.flux - (1 - transitDepth)) / transitDepth) *
                    LIGHT_CURVE_HEIGHT *
                    0.7;
                return `${x},${y}`;
              })
              .join(" ")}
          />
          <line
            x1={(scrubValue / SCRUB_STEPS) * width}
            x2={(scrubValue / SCRUB_STEPS) * width}
            y1={0}
            y2={LIGHT_CURVE_HEIGHT}
            stroke="#FFC8E6"
            strokeWidth={2}
          />
        </svg>
      </div>

      <PlaybackControls
        current={scrubValue}
        total={SCRUB_STEPS}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying((p) => !p)}
        onStep={(dir) =>
          setSimTime(
            (prev) =>
              (prev + dir * (config.periodSeconds / 40) + config.periodSeconds) %
              config.periodSeconds,
          )
        }
        onScrub={(v) => {
          setIsPlaying(false);
          setSimTime((v / SCRUB_STEPS) * config.periodSeconds);
        }}
        onReset={() => {
          setIsPlaying(false);
          setSimTime(0);
        }}
        label={`t = ${simTime.toFixed(2)}s`}
      />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-code">{label}</span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
      />
    </label>
  );
}
