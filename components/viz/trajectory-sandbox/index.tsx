"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PlaybackControls } from "@/components/viz/playback-controls";
import { Slider } from "@/components/ui/slider";
import { themeColors } from "@/lib/theme-colors";
import { PHYSICS_FUNCTIONS } from "./physics-functions";
import type { TrajectorySandboxConfig } from "./types";

const SCRUB_STEPS = 200;
const CANVAS_HEIGHT = 240;
const PADDING_PX = 24;

export function TrajectorySandbox({
  config,
}: {
  config: TrajectorySandboxConfig;
}) {
  // Safe: isTrajectorySandboxConfig (types.ts) validates config.physicsType
  // against PHYSICS_TYPE_KEYS before a config ever reaches this component
  // (see viz-engine.tsx's dispatch), so this lookup can never miss here.
  const physics = PHYSICS_FUNCTIONS[config.physicsType]!;

  const [speed, setSpeed] = useState(config.initial.speed);
  const [angleDeg, setAngleDeg] = useState(config.initial.angleDeg);
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

  const initial = useMemo(() => ({ speed, angleDeg }), [speed, angleDeg]);
  const flightTime = physics.flightTime(initial, config.gravity);

  // Adjusting a slider restarts the flight — avoids a marker stuck past the
  // end of a now-shorter trajectory.
  useEffect(() => {
    setSimTime(0);
    setIsPlaying(false);
  }, [speed, angleDeg]);

  // rAF playback loop, real elapsed time drives sim time 1:1.
  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = undefined;
      return;
    }
    function frame(now: number) {
      if (lastFrameRef.current === undefined) lastFrameRef.current = now;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      setSimTime((prev) => {
        const next = prev + dt;
        if (next >= flightTime) {
          setIsPlaying(false);
          return flightTime;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, flightTime]);

  // Draw.
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

    const maxRange = physics.position(flightTime, initial, config.gravity).x;
    const plotW = width - PADDING_PX * 2;
    const scale = plotW / Math.max(maxRange, 1);

    const groundY = CANVAS_HEIGHT - PADDING_PX;
    const toPx = (p: { x: number; y: number }) => ({
      x: PADDING_PX + p.x * scale,
      y: groundY - p.y * scale,
    });

    // Ground.
    ctx.strokeStyle = themeColors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Path (dashed, full flight preview).
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = themeColors.blue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const samples = 60;
    for (let i = 0; i <= samples; i++) {
      const sampleT = (flightTime * i) / samples;
      const p = toPx(physics.position(sampleT, initial, config.gravity));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Marker at current sim time.
    const markerPos = toPx(physics.position(simTime, initial, config.gravity));
    ctx.fillStyle = themeColors.pinkAlt;
    ctx.strokeStyle = themeColors.blueAlt;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(markerPos.x, markerPos.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [width, simTime, initial, config.gravity, physics, flightTime]);

  const maxRange = physics.position(flightTime, initial, config.gravity).x;
  const maxHeight = physics.position(flightTime / 2, initial, config.gravity).y;
  const scrubValue = flightTime > 0 ? Math.round((simTime / flightTime) * SCRUB_STEPS) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SliderField
          label={`v₀ = ${speed.toFixed(0)} m/s`}
          value={speed}
          min={config.speedRange?.[0] ?? 5}
          max={config.speedRange?.[1] ?? 40}
          step={1}
          onChange={setSpeed}
        />
        <SliderField
          label={`θ = ${angleDeg.toFixed(0)}°`}
          value={angleDeg}
          min={config.angleRange?.[0] ?? 5}
          max={config.angleRange?.[1] ?? 85}
          step={1}
          onChange={setAngleDeg}
        />
      </div>

      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
        range ≈ {maxRange.toFixed(1)} m · max height ≈ {maxHeight.toFixed(1)} m
      </p>

      <PlaybackControls
        current={scrubValue}
        total={SCRUB_STEPS}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying((p) => !p)}
        onStep={(dir) =>
          setSimTime((prev) =>
            Math.min(Math.max(prev + dir * (flightTime / 20), 0), flightTime),
          )
        }
        onScrub={(v) => {
          setIsPlaying(false);
          setSimTime((v / SCRUB_STEPS) * flightTime);
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
