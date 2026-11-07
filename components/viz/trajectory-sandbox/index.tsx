"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PlaybackControls } from "@/components/viz/playback-controls";
import { setupCanvasForDpr } from "@/components/viz/shared/canvas-dpr";
import { MarkdownText } from "@/components/viz/shared/markdown-text";
import { Slider } from "@/components/ui/slider";
import { themeColors } from "@/lib/theme-colors";
import {
  CANVAS_HEIGHT,
  HANDLE_SIZE_PX,
  PADDING_PX,
  angleFromPointer,
  clamp,
  handleCentre,
  keyboardAngleDelta,
  launchOrigin,
  snapToStep,
} from "./launch-handle";
import { PHYSICS_FUNCTIONS } from "./physics-functions";
import {
  ANGLE_STEP,
  SPEED_STEP,
  angleRangeOf,
  landingRange,
  speedRangeOf,
} from "./types";
import type { TrajectorySandboxConfig } from "./types";

const SCRUB_STEPS = 200;
// R3: how many missed launches before the hint appears.
const HINT_AFTER_FAILED_ATTEMPTS = 2;

// R3: the verdict on one finished launch. Pure and exported so the rule the
// issue states, |landingX - target.rangeM| <= toleranceM, is tested directly.
export function judgeAttempt(
  landingX: number,
  target: { rangeM: number; toleranceM: number },
): { hit: boolean; shortByM: number } {
  const gap = target.rangeM - landingX; // > 0: landed short, < 0: landed long
  return { hit: Math.abs(gap) <= target.toleranceM, shortByM: gap };
}

type AttemptResult = { landingX: number; hit: boolean; shortByM: number } | null;

export function TrajectorySandbox({
  config,
}: {
  config: TrajectorySandboxConfig;
}) {
  const t = useTranslations("viz");
  // Safe: isTrajectorySandboxConfig (types.ts) validates config.physicsType
  // against PHYSICS_TYPE_KEYS before a config ever reaches this component
  // (see viz-engine.tsx's dispatch), so this lookup can never miss here.
  const physics = PHYSICS_FUNCTIONS[config.physicsType]!;
  const challenge = config.challenge;
  const speedRange = speedRangeOf(config);
  const angleRange = angleRangeOf(config);

  const [speed, setSpeed] = useState(config.initial.speed);
  const [angleDeg, setAngleDeg] = useState(config.initial.angleDeg);
  const [simTime, setSimTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [width, setWidth] = useState(320);
  // R3: attempt tracking is local component state only (the proposal's
  // answer to open question 3); it resets with the page, never persists.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [attempt, setAttempt] = useState<AttemptResult>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(undefined);
  const lastFrameRef = useRef<number>(undefined);
  // Set (idempotently) by the playback loop when a flight runs to its end by
  // itself. Scrubbing or stepping to the end is NOT a launch, so it must not
  // count as an attempt.
  const landedByPlaybackRef = useRef(false);
  // True once a flight has been started with Play from t = 0 and not
  // repositioned since. Pressing Play with the marker already parked at the
  // end of the flight lands instantly without having launched anything, and
  // must not be counted as another attempt.
  const launchedFromStartRef = useRef(false);

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
    setAttempt(null); // the previous verdict no longer describes this launch
    launchedFromStartRef.current = false;
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
          landedByPlaybackRef.current = true;
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

  // R3: judge the launch once playback has stopped at the end of the flight.
  useEffect(() => {
    if (isPlaying || !landedByPlaybackRef.current) return;
    landedByPlaybackRef.current = false;
    const launched = launchedFromStartRef.current;
    launchedFromStartRef.current = false;
    if (!challenge || !launched) return;
    const landingX = landingRange(config.physicsType, initial, config.gravity);
    const verdict = judgeAttempt(landingX, challenge.target);
    setAttempt({ landingX, ...verdict });
    if (!verdict.hit) setFailedAttempts((n) => n + 1);
  }, [isPlaying, challenge, config.physicsType, config.gravity, initial]);

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvasForDpr(canvas, width, CANVAS_HEIGHT);
    if (!ctx) return;

    // The complementary launch (90° − θ, same speed) is drawn as a faint
    // ghost so the idea of the editorial, "same range, different path", is
    // visible before anything is dragged. At 45° it coincides with the live
    // arc, so it is skipped there.
    const ghostInitial = { speed, angleDeg: 90 - angleDeg };
    const ghostFlightTime = physics.flightTime(ghostInitial, config.gravity);
    const showGhost = Math.abs(angleDeg - 45) > 0.5;

    const peakOf = (init: typeof initial, ft: number) =>
      physics.position(ft / 2, init, config.gravity).y;
    // R3: the target (including its tolerance band) is part of what must fit,
    // so it is never clipped off the right-hand edge.
    const targetFar = challenge ? challenge.target.rangeM + challenge.target.toleranceM : 0;
    const maxRange = Math.max(
      physics.position(flightTime, initial, config.gravity).x,
      showGhost ? physics.position(ghostFlightTime, ghostInitial, config.gravity).x : 0,
      targetFar,
    );
    const maxPeak = Math.max(
      peakOf(initial, flightTime),
      showGhost ? peakOf(ghostInitial, ghostFlightTime) : 0,
    );
    const plotW = width - PADDING_PX * 2;
    const plotH = CANVAS_HEIGHT - PADDING_PX * 2;
    // Fit BOTH axes (one scale, so the arc keeps its true shape): a flat arc
    // is limited by width, a tall one by height, and nothing is clipped or
    // left floating in dead space.
    const scale = Math.min(plotW / Math.max(maxRange, 1), plotH / Math.max(maxPeak, 1));

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

    const tracePath = (init: typeof initial, ft: number) => {
      ctx.beginPath();
      const samples = 60;
      for (let i = 0; i <= samples; i++) {
        const p = toPx(physics.position((ft * i) / samples, init, config.gravity));
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };

    // R3: the target — a band on the ground spanning rangeM ± toleranceM,
    // with a tick at the centre.
    if (challenge) {
      const { rangeM, toleranceM } = challenge.target;
      const left = toPx({ x: Math.max(rangeM - toleranceM, 0), y: 0 }).x;
      const right = toPx({ x: rangeM + toleranceM, y: 0 }).x;
      ctx.fillStyle = themeColors.pink;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(left, groundY - 3, Math.max(right - left, 2), 6);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = themeColors.pinkAlt;
      ctx.lineWidth = 2;
      const centreX = toPx({ x: rangeM, y: 0 }).x;
      ctx.beginPath();
      ctx.moveTo(centreX, groundY - 8);
      ctx.lineTo(centreX, groundY + 8);
      ctx.stroke();
    }

    // R2: a faint guide from the launch origin to the drag handle, so the
    // handle reads as "the end of the launch direction".
    const origin = launchOrigin();
    const handle = handleCentre(angleDeg);
    ctx.strokeStyle = themeColors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(handle.x, handle.y);
    ctx.stroke();

    // Ghost: complementary angle, dotted pink.
    if (showGhost) {
      ctx.setLineDash([2, 5]);
      ctx.lineCap = "round";
      ctx.strokeStyle = themeColors.pink;
      ctx.lineWidth = 2;
      tracePath(ghostInitial, ghostFlightTime);
      ctx.lineCap = "butt";
    }

    // Path (dashed, full flight preview).
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = themeColors.blue;
    ctx.lineWidth = 2;
    tracePath(initial, flightTime);
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
  }, [width, simTime, initial, speed, angleDeg, config.gravity, physics, flightTime, challenge]);

  // R2: dragging / keyboard on the launch handle. All three routes (drag,
  // arrow keys, angle slider) write the same `angleDeg` state, so they stay
  // in sync by construction, and the existing [speed, angleDeg] effect above
  // restarts the flight when any of them moves.
  function setAngleFromPointer(clientX: number, clientY: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAngleDeg(
      angleFromPointer({ x: clientX - rect.left, y: clientY - rect.top }, angleRange, ANGLE_STEP),
    );
  }

  function onHandleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    if (e.key === "Home") next = angleRange[0];
    else if (e.key === "End") next = angleRange[1];
    else {
      const delta = keyboardAngleDelta(e.key, e.shiftKey);
      if (delta !== null) next = angleDeg + delta;
    }
    if (next === null) return;
    e.preventDefault();
    setAngleDeg(snapToStep(clamp(next, angleRange[0], angleRange[1]), angleRange, ANGLE_STEP));
  }

  const handlePos = handleCentre(angleDeg);

  const maxRange = physics.position(flightTime, initial, config.gravity).x;
  const maxHeight = physics.position(flightTime / 2, initial, config.gravity).y;
  const scrubValue = flightTime > 0 ? Math.round((simTime / flightTime) * SCRUB_STEPS) : 0;
  const showLegend = Math.abs(angleDeg - 45) > 0.5;

  const showHint =
    challenge?.hint !== undefined &&
    failedAttempts >= HINT_AFTER_FAILED_ATTEMPTS &&
    !(attempt?.hit ?? false);

  return (
    <div className="flex flex-col gap-3">
      {challenge && (
        <div className="flex flex-col gap-1">
          <MarkdownText text={challenge.prompt} className="text-sm text-foreground/85" />
          <p className="label-mono">
            {t("challengeTarget", {
              range: challenge.target.rangeM,
              tolerance: challenge.target.toleranceM,
            })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SliderField
          label={`v₀ = ${speed.toFixed(0)} m/s`}
          value={speed}
          min={speedRange[0]}
          max={speedRange[1]}
          step={SPEED_STEP}
          onChange={setSpeed}
        />
        <SliderField
          label={`θ = ${angleDeg.toFixed(0)}°`}
          value={angleDeg}
          min={angleRange[0]}
          max={angleRange[1]}
          step={ANGLE_STEP}
          onChange={setAngleDeg}
        />
      </div>

      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          className="w-full"
          role="img"
          aria-label={t("trajectoryLabel", {
            speed: speed.toFixed(0),
            angle: angleDeg.toFixed(0),
          })}
        />
        {/* R2: a small DOM handle, not pointer handling on the whole canvas —
            touch-action: none over a full-width canvas would trap page
            scrolling on phones. Only this element opts out of scrolling.
            The angle slider above stays as the accessible fallback. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label={t("trajectoryHandleLabel")}
          aria-valuemin={angleRange[0]}
          aria-valuemax={angleRange[1]}
          aria-valuenow={angleDeg}
          aria-valuetext={`${angleDeg.toFixed(0)}°`}
          data-testid="trajectory-angle-handle"
          className="absolute flex cursor-grab touch-none select-none items-center justify-center rounded-full outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-cherenkov-blue-700 dark:focus-visible:ring-cherenkov-blue-pastel"
          style={{
            left: handlePos.x - HANDLE_SIZE_PX / 2,
            top: handlePos.y - HANDLE_SIZE_PX / 2,
            width: HANDLE_SIZE_PX,
            height: HANDLE_SIZE_PX,
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setAngleFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            setAngleFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
          onKeyDown={onHandleKeyDown}
        >
          <span
            aria-hidden
            className="block h-4 w-4 rounded-full border-2 border-cherenkov-blue-700 bg-white shadow dark:border-cherenkov-blue-pastel dark:bg-slate-900"
          />
        </div>
      </div>

      {challenge && attempt && (
        <div role="status" className="flex flex-col gap-1 text-sm">
          {attempt.hit ? (
            <>
              <p className="font-medium">
                {t("challengeSuccess", { landing: attempt.landingX.toFixed(1) })}
              </p>
              {challenge.successNote && (
                <MarkdownText text={challenge.successNote} className="text-foreground/75" />
              )}
            </>
          ) : (
            <p className="font-medium">
              {attempt.shortByM > 0
                ? t("challengeMissShort", {
                    landing: attempt.landingX.toFixed(1),
                    gap: attempt.shortByM.toFixed(1),
                  })
                : t("challengeMissLong", {
                    landing: attempt.landingX.toFixed(1),
                    gap: Math.abs(attempt.shortByM).toFixed(1),
                  })}
            </p>
          )}
        </div>
      )}

      {showHint && challenge?.hint && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <span className="label-mono">{t("challengeHintLabel")}</span>
          <MarkdownText text={challenge.hint} className="text-foreground/75" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="label-mono">
          range ≈ {maxRange.toFixed(1)} m · max height ≈ {maxHeight.toFixed(1)} m
        </p>
        {/* Kept in the layout (just hidden) at 45°, where the two arcs
            coincide: removing it made the whole visualization, and anything
            laid out around it, jump in height whenever the angle slider
            crossed 45°. */}
        <p
          className={`label-mono flex items-center gap-3 ${showLegend ? "" : "invisible"}`}
          aria-hidden={showLegend ? undefined : true}
        >
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-cherenkov-blue-700 dark:border-cherenkov-blue-400" />
            {t("trajectoryLegendLaunch", { angle: angleDeg.toFixed(0) })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block w-5 border-t-2 border-dotted border-cherenkov-pink-400" />
            {t("trajectoryLegendComplement", { angle: (90 - angleDeg).toFixed(0) })}
          </span>
        </p>
      </div>

      <PlaybackControls
        current={scrubValue}
        total={SCRUB_STEPS}
        isPlaying={isPlaying}
        onPlayPause={() => {
          if (!isPlaying && simTime <= 0) launchedFromStartRef.current = true;
          setIsPlaying((p) => !p);
        }}
        onStep={(dir) => {
          launchedFromStartRef.current = false;
          setSimTime((prev) =>
            Math.min(Math.max(prev + dir * (flightTime / 20), 0), flightTime),
          );
        }}
        onScrub={(v) => {
          launchedFromStartRef.current = false;
          setIsPlaying(false);
          setSimTime((v / SCRUB_STEPS) * flightTime);
        }}
        onReset={() => {
          launchedFromStartRef.current = false;
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
      <span className="label-mono">{label}</span>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
      />
    </label>
  );
}
