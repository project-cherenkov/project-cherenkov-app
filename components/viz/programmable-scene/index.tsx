"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Slider } from "@/components/ui/slider";
import { setupCanvasForDpr } from "@/components/viz/shared/canvas-dpr";
import { renderElements } from "@/components/viz/composed-scene/render-elements";
import type { ScaleFns } from "@/components/viz/composed-scene/element-templates";
import type { SceneElement } from "@/components/viz/composed-scene/types";
import { OPERATION_BUDGET, runProgram } from "./interpreter";
import type { ProgramControl, ProgrammableSceneConfig } from "./types";

// This tick's interpreter-calling decision, pulled out as a pure function —
// the same rationale composed-scene/index.tsx's own resolveElementParams
// already established in this codebase: the actual novel logic beyond
// "loop and draw" is worth unit-testing without a DOM (this repo's
// component tests are all renderToStaticMarkup-based, i.e. SSR-only —
// ProgrammableScene's own useEffect/rAF loop never runs during a render()
// call in a test, so anything that needs verifying about *what a frame
// decides to do* has to live somewhere effects aren't required to reach
// it).
//
// Spec §5/§6's "on budgetExceeded: keep last frame, show notice, never
// blank" boils down to exactly one decision per tick — whether this tick's
// output is safe to draw at all. `shouldDraw: false` means the component's
// draw effect below must skip setupCanvasForDpr/renderElements ENTIRELY:
// not draw a partial/truncated element set, and not clear the canvas
// either. There is no "remembered previous frame" to manage as data here —
// simply never touching the canvas is what leaves its already-rendered
// pixels in place; canvas content is state the DOM already owns.
export interface FrameDecision {
  shouldDraw: boolean;
  elements: SceneElement[];
  showNotice: boolean;
}

export function decideFrame(
  config: ProgrammableSceneConfig,
  t: number,
  controlValues: Record<string, number | boolean>,
  budget: number = OPERATION_BUDGET,
): FrameDecision {
  const result = runProgram(config.program, { t, controls: controlValues }, budget);
  return {
    shouldDraw: !result.budgetExceeded,
    elements: result.elements,
    showNotice: result.budgetExceeded,
  };
}

// Standalone specifically so it's directly renderToStaticMarkup-testable
// (this repo's existing component-test convention, e.g.
// composed-scene/index.test.tsx) independent of ProgrammableScene's own
// rAF-driven state, which SSR never executes.
export function TakingTooLongNotice({ show }: { show: boolean }) {
  const t = useTranslations("viz");
  if (!show) return null;
  return (
    <p
      role="status"
      data-testid="programmable-scene-budget-notice"
      className="text-sm text-amber-600 dark:text-amber-400"
    >
      {t("programmableSceneBudgetNotice")}
    </p>
  );
}

// Reader-facing runtime for a programmable-scene config: a continuous
// requestAnimationFrame loop (matching trajectory-sandbox's existing rAF
// pattern) feeding runProgram's per-tick output into the same
// renderElements composed-scene already uses. Unlike ComposedScene's
// discrete-step timer, this always runs while mounted — no isPlaying gate
// — since full reactive interactivity (spec §5) means re-evaluating on
// every frame, not only on discrete authored steps. Reused unmodified as
// the scene builder's own live preview for this engine, same posture
// composed-scene's own doc comment holds for itself.
export function ProgrammableScene({ config }: { config: ProgrammableSceneConfig }) {
  const [width, setWidth] = useState(320);
  const [controlValues, setControlValues] = useState<Record<string, number | boolean>>({});
  const [budgetExceeded, setBudgetExceeded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(undefined);
  const startRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A wholly new config (e.g. the builder's live preview after an edit)
  // restarts the elapsed-time clock — mirrors ComposedScene's own "reset to
  // the first step whenever a different config is supplied", adapted for a
  // continuous clock rather than a step index.
  useEffect(() => {
    startRef.current = undefined;
  }, [config]);

  const scaleFactor = width > 0 ? width / config.canvas.widthPx : 1;
  const renderedHeight = config.canvas.heightPx * scaleFactor;

  const scale: ScaleFns = useMemo(
    () => ({
      x: (v: number) => v * scaleFactor,
      y: (v: number) => v * scaleFactor,
      length: (v: number) => v * scaleFactor,
    }),
    [scaleFactor],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const canvasEl = canvas; // rebind so TS retains the non-null narrowing inside the nested frame() closure below
    let cancelled = false;

    function frame(now: number) {
      if (cancelled) return;
      if (startRef.current === undefined) startRef.current = now;
      const elapsedSeconds = (now - startRef.current) / 1000;

      const decision = decideFrame(config, elapsedSeconds, controlValues);
      setBudgetExceeded(decision.showNotice);
      if (decision.shouldDraw) {
        const ctx = setupCanvasForDpr(canvasEl, width, renderedHeight);
        if (ctx) renderElements(ctx, decision.elements, undefined, {}, undefined, scale);
      }
      // else: deliberately don't touch the canvas at all — see
      // decideFrame's own doc comment above.

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // Re-subscribing on every controlValues change restarts the rAF chain,
    // but `startRef` isn't cleared by this effect's own cleanup (only by
    // the config-change effect above), so elapsedSeconds continues
    // seamlessly rather than jumping back to 0 on every slider tweak —
    // same tradeoff trajectory-sandbox's own rAF effect already accepts
    // for its speed/angle sliders.
  }, [config, width, renderedHeight, scale, controlValues]);

  return (
    <div className="flex flex-col gap-4">
      {config.controls && config.controls.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {config.controls.map((control) => (
            <ProgramControlField
              key={control.id}
              control={control}
              value={controlValues[control.id]}
              onChange={(value) => setControlValues((prev) => ({ ...prev, [control.id]: value }))}
            />
          ))}
        </div>
      )}

      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" data-testid="programmable-scene-canvas" />
      </div>

      <TakingTooLongNotice show={budgetExceeded} />
    </div>
  );
}

function ProgramControlField({
  control,
  value,
  onChange,
}: {
  control: ProgramControl;
  value: number | boolean | undefined;
  onChange: (value: number | boolean) => void;
}) {
  if (control.kind === "toggle") {
    const current = typeof value === "boolean" ? value : false;
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={current} onChange={(e) => onChange(e.target.checked)} />
        {control.label}
      </label>
    );
  }

  const current = typeof value === "number" ? value : 0;
  return (
    <label className="flex flex-col gap-1">
      <span className="label-code">{control.label}</span>
      <Slider
        min={control.min ?? 0}
        max={control.max ?? 100}
        step={control.step ?? 1}
        value={[current]}
        onValueChange={([v]) => onChange(v ?? current)}
      />
    </label>
  );
}
