"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PlaybackControls } from "@/components/viz/playback-controls";
import { Slider } from "@/components/ui/slider";
import { themeColors } from "@/lib/theme-colors";
import {
  fluxAt,
  orbitGeometry,
  planetOffsetAt,
  transitHalfWidthSeconds,
} from "./physics-functions";
import type { OrbitalSandboxConfig } from "./types";

const SCRUB_STEPS = 200;
const CANVAS_HEIGHT = 220;
const LIGHT_CURVE_HEIGHT = 64;
const PADDING_PX = 20;

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

  const { a, b, c, meanMotion } = orbitGeometry(
    config.semiMajorAxisPx,
    eccentricity,
    config.periodSeconds,
  );

  const halfWidthSeconds = transitHalfWidthSeconds(
    eccentricity,
    config.periodSeconds,
  );

  const lightCurve = useMemo(() => {
    const samples = 160;
    return Array.from({ length: samples + 1 }, (_, i) => {
      const time = (config.periodSeconds * i) / samples;
      return {
        time,
        flux: fluxAt(time, config.periodSeconds, halfWidthSeconds, transitDepth),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eccentricity, transitDepth, config.periodSeconds, halfWidthSeconds]);

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

    const planetOffset = planetOffsetAt(simTime, eccentricity, { a, b, c, meanMotion });
    const starOffset = { x: -massRatio * planetOffset.x, y: -massRatio * planetOffset.y };

    drawOrbitEllipse(ctx, cx, cy, a * fit, b * fit);
    drawStar(ctx, cx + starOffset.x * fit, cy + starOffset.y * fit);
    drawPlanet(ctx, cx + planetOffset.x * fit, cy + planetOffset.y * fit);
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
            stroke={themeColors.blueAlt}
            strokeWidth={2}
            points={lightCurvePoints(lightCurve, width, transitDepth)}
          />
          <line
            x1={(scrubValue / SCRUB_STEPS) * width}
            x2={(scrubValue / SCRUB_STEPS) * width}
            y1={0}
            y2={LIGHT_CURVE_HEIGHT}
            stroke={themeColors.pinkAlt}
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

function drawOrbitEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
) {
  // Centered on the barycenter at canvas center.
  ctx.strokeStyle = themeColors.grid;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = themeColors.pinkAlt;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = themeColors.blue;
  ctx.strokeStyle = themeColors.blueAlt;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// SVG polyline points for the transit light curve, one per lightCurve
// sample, scaled to the plot's width/height and the config's transit
// depth.
function lightCurvePoints(
  lightCurve: { time: number; flux: number }[],
  width: number,
  transitDepth: number,
): string {
  return lightCurve
    .map((p, i) => {
      const x = (i / (lightCurve.length - 1)) * width;
      const y =
        LIGHT_CURVE_HEIGHT * 0.15 +
        (1 - (p.flux - (1 - transitDepth)) / transitDepth) *
          LIGHT_CURVE_HEIGHT *
          0.7;
      return `${x},${y}`;
    })
    .join(" ");
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
