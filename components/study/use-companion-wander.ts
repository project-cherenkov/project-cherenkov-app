// Random wandering for the floating companion. Replaces the old fixed CSS
// keyframe loop (corner -> down -> across -> home), which always traced the
// same path. Each leg now has a random destination anywhere on screen, a
// gently curved route, a varied easing and speed, and a random pause at the
// end, with the occasional short dart or longer rest so it feels alive.
//
// The dock's own left/top stay where they are; this only animates a
// transform offset on top of them (Web Animations API), so dragging, the
// panel anchor and the trail sampler keep working unchanged.

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

type Point = { x: number; y: number };
export type WanderBounds = { minX: number; maxX: number; minY: number; maxY: number };

const EASINGS = [
  "ease-in-out",
  "cubic-bezier(0.45, 0.05, 0.25, 1)",
  "cubic-bezier(0.65, 0, 0.35, 1)",
  "cubic-bezier(0.3, 0.6, 0.4, 1)",
  "cubic-bezier(0.55, 0, 0.2, 1)",
];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function pickTarget(from: Point, b: WanderBounds): (Point & { distance: number }) | null {
  const spanX = Math.max(0, b.maxX - b.minX);
  const spanY = Math.max(0, b.maxY - b.minY);
  const diagonal = Math.hypot(spanX, spanY);
  if (diagonal < 1) return { x: from.x, y: from.y, distance: 0 };

  // About one leg in four is a short dart near the current spot; the rest
  // can end anywhere in the roam area.
  const dart = Math.random() < 0.25;
  const minDistance = Math.min(140, diagonal * 0.18);
  let best: (Point & { distance: number }) | null = null;
  for (let i = 0; i < 8; i += 1) {
    const candidate = dart
      ? {
          x: Math.min(b.maxX, Math.max(b.minX, from.x + rand(-1, 1) * Math.min(160, spanX / 2))),
          y: Math.min(b.maxY, Math.max(b.minY, from.y + rand(-1, 1) * Math.min(160, spanY / 2))),
        }
      : { x: rand(b.minX, b.maxX), y: rand(b.minY, b.maxY) };
    const distance = Math.hypot(candidate.x - from.x, candidate.y - from.y);
    if (!best || distance > best.distance) best = { ...candidate, distance };
    if (distance >= minDistance) return { ...candidate, distance };
  }
  return best;
}

// Sample a quadratic Bezier so the route bows to one side instead of running
// in a straight line. Linear interpolation between the samples is smooth
// enough at this size, and the effect-level easing shapes the speed.
function curvedFrames(from: Point, to: Point, bounds: WanderBounds): Keyframe[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const bow = rand(-0.28, 0.28) * length;
  let cx = (from.x + to.x) / 2 + (-dy / length) * bow;
  let cy = (from.y + to.y) / 2 + (dx / length) * bow;
  cx = Math.min(bounds.maxX, Math.max(bounds.minX, cx));
  cy = Math.min(bounds.maxY, Math.max(bounds.minY, cy));
  const steps = 10;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * from.x + 2 * u * t * cx + t * t * to.x;
    const y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
    frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` });
  }
  return frames;
}

/**
 * @param ref      the dock element
 * @param enabled  ambient motion is on (and reduced motion is not requested)
 * @param paused   hold still (panel open, focused, recently touched)
 * @param speed    the drift speed preference (50-150, 100 = 1x)
 * @param bounds   allowed transform offsets { minX, maxX, minY, maxY }
 * @param resetKey anything that should send it back to its resting spot
 */
export function useCompanionWander({
  ref,
  enabled,
  paused,
  speed,
  bounds,
  resetKey,
}: {
  ref: RefObject<HTMLElement | null>;
  enabled: boolean;
  paused: boolean;
  speed: number;
  bounds: WanderBounds;
  resetKey: string;
}) {
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const boundsRef = useRef(bounds);
  const animationRef = useRef<Animation | null>(null);
  pausedRef.current = paused;
  speedRef.current = speed;
  boundsRef.current = bounds;

  // A layout effect, so that when `enabled` flips off (a drag starts, the dock is
  // moved) the leftover transform is cancelled in the same commit that changes
  // the dock's left/top, before the browser paints. A passive effect is allowed
  // to run after the paint, which would show the dock displaced by its old
  // wander offset for a moment.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof el.animate !== "function") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const node: HTMLElement = el;
    let cancelled = false;
    let timer: number | null = null;
    let at = { x: 0, y: 0 };

    function leg(): void {
      if (cancelled) return;
      const b = boundsRef.current;
      const target = pickTarget(at, b);
      if (!target || target.distance < 1) {
        timer = window.setTimeout(leg, 2000);
        return;
      }
      // Pixels per second, jittered per leg so no two journeys feel alike.
      const pxPerSecond = 95 * (speedRef.current / 100) * rand(0.7, 1.5);
      const duration = Math.max(1600, (target.distance / pxPerSecond) * 1000);
      const from = at;
      const to = { x: target.x, y: target.y };
      const animation = node.animate(curvedFrames(from, to, b), {
        duration,
        easing: EASINGS[Math.floor(Math.random() * EASINGS.length)] ?? "ease-in-out",
        fill: "forwards",
      });
      animationRef.current = animation;
      if (pausedRef.current) animation.pause();
      animation.onfinish = () => {
        if (cancelled || animationRef.current !== animation) return;
        at = to;
        // Mostly short pauses, sometimes a long rest.
        const rest = Math.random() < 0.2 ? rand(3500, 7000) : rand(500, 2600);
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(leg, rest);
      };
    }

    timer = window.setTimeout(leg, rand(600, 2200));
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      animationRef.current?.cancel();
      animationRef.current = null;
    };
    // bounds are read through a ref; these values change only when the dock's
    // resting spot or the viewport changes, which should restart from zero.
  }, [ref, enabled, resetKey]);

  useEffect(() => {
    const animation = animationRef.current;
    if (!animation) return;
    // Only touch a leg that is actually in flight. A finished leg (the dock is
    // resting between legs) must be left alone: play() on a finished animation
    // rewinds it to the start, which sends the dock back to where the leg began,
    // replays it, and then starts a second chain of legs on top of the first.
    if (paused) {
      if (animation.playState === "running") animation.pause();
    } else if (animation.playState === "paused") {
      animation.play();
    }
  }, [paused]);
}
