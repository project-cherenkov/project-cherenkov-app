"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PlaybackControls } from "@/components/viz/playback-controls";
import { Slider } from "@/components/ui/slider";
import type { TrajectorySandboxConfig } from "./types";

const SCRUB_STEPS = 200;
const CANVAS_HEIGHT = 240;
const PADDING_PX = 24;

interface Initial {
  speed: number;
  angleDeg: number;
}

// Named-function registry — see the comment in types.ts for why vizConfig
// can't hold a literal function. Add a new scenario by adding a key here.
const PHYSICS_FUNCTIONS: Record<
  string,
  {
    position: (t: number, initial: Initial, gravity: number) => { x: number; y: number };
    flightTime: (initial: Initial, gravity: number) => number;
  }
> = {
  projectile: {
    position: (t, initial, gravity) => {
      const theta = (initial.angleDeg * Math.PI) / 180;
      const x = initial.speed * Math.cos(theta) * t;
      const y = Math.max(
        initial.speed * Math.sin(theta) * t - 0.5 * gravity * t * t,
        0,
      );
      return { x, y };
    },
    flightTime: (initial, gravity) =>
      (2 * initial.speed * Math.sin((initial.angleDeg * Math.PI) / 180)) /
      gravity,
  },
};

export function TrajectorySandbox({
  config,
}: {
  config: TrajectorySandboxConfig;
}) {
  const t = useTranslations("viz");
  const physics = PHYSICS_FUNCTIONS[config.physicsType];

  const [speed, setSpeed] = useState(config.initial.speed);
  const [angleDeg, setAngleDeg] = useState(config.initial.angleDeg);
  const [simTime, setSimTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [width, setWidth] = useState(320);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastFrameRef = useRef<number>();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const maxHeight = physics.position(flightTime / 2, initial, config.gravity).y;
    const plotW = width - PADDING_PX * 2;
    const plotH = CANVAS_HEIGHT - PADDING_PX * 2;
    const scale = Math.min(
      plotW / Math.max(maxRange, 1),
      plotH / Math.max(maxHeight * 1.25, 1),
    );

    const groundY = CANVAS_HEIGHT - PADDING_PX;
    const toPx = (p: { x: number; y: number }) => ({
      x: PADDING_PX + p.x * scale,
      y: groundY - p.y * scale,
    });

    // Ground.
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Path (dashed, full flight preview).
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#5BCEFA";
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
    ctx.fillStyle = "#FFC8E6";
    ctx.strokeStyle = "#8AD7FF";
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

      <p className="font-mono text-xs text-slate-500">
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
