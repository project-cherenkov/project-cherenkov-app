// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCompanionWander } from "./use-companion-wander";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no Web Animations API, so this stands in for one leg of the journey.
// Calling pause() or play() on a finished leg is recorded, because in a real
// browser that rewinds the leg: the dock jumps back to where the leg began and
// replays it (checked in Chromium: the element went from x=300 back to ~25).
class FakeAnimation {
  playState: "running" | "paused" | "finished" = "running";
  onfinish: (() => void) | null = null;
  touchedWhileFinished = 0;
  pause = vi.fn(() => {
    if (this.playState === "finished") this.touchedWhileFinished += 1;
    this.playState = "paused";
  });
  play = vi.fn(() => {
    if (this.playState === "finished") this.touchedWhileFinished += 1;
    this.playState = "running";
  });
  cancel = vi.fn();
  finish() {
    this.playState = "finished";
    this.onfinish?.();
  }
}

const bounds = { minX: -300, maxX: 300, minY: -200, maxY: 200 };
function Harness({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useCompanionWander({ ref, enabled: true, paused, speed: 100, bounds, resetKey: "a" });
  return <div ref={ref} />;
}

let container: HTMLDivElement;
let root: Root;
let legs: FakeAnimation[];

function render(paused: boolean) {
  act(() => root.render(<Harness paused={paused} />));
}
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  legs = [];
  HTMLElement.prototype.animate = vi.fn(() => {
    const leg = new FakeAnimation();
    legs.push(leg);
    return leg as unknown as Animation;
  }) as never;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useCompanionWander", () => {
  it("starts a first leg after a short delay", () => {
    render(false);
    expect(legs).toHaveLength(0);
    advance(2500);
    expect(legs).toHaveLength(1);
  });

  it("pauses a leg in flight and resumes the same leg", () => {
    render(false);
    advance(2500);
    const [leg] = legs;
    render(true);
    expect(leg!.pause).toHaveBeenCalledTimes(1);
    render(false);
    expect(leg!.play).toHaveBeenCalledTimes(1);
    expect(legs).toHaveLength(1);
  });

  it("leaves a finished leg alone while pausing and resuming", () => {
    render(false);
    advance(2500);
    const [leg] = legs;
    act(() => leg!.finish()); // the dock is now resting between legs
    render(true);
    render(false);
    expect(leg!.touchedWhileFinished).toBe(0);
    expect(leg!.pause).not.toHaveBeenCalled();
    expect(leg!.play).not.toHaveBeenCalled();
  });

  it("never runs two chains of legs, even if a leg reports finishing twice", () => {
    render(false);
    advance(2500);
    const [leg] = legs;
    act(() => leg!.finish());
    act(() => leg!.onfinish?.());
    advance(10_000); // longer than the longest rest
    expect(legs).toHaveLength(2);
  });
});
