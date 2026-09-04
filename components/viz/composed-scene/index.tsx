"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PlaybackControls } from "@/components/viz/playback-controls";
import { Slider } from "@/components/ui/slider";
import { setupCanvasForDpr } from "@/components/viz/shared/canvas-dpr";
import { MarkdownText } from "@/components/viz/shared/markdown-text";
import { ELEMENT_TEMPLATES } from "./element-templates";
import type { ResolvedParams, ScaleFns } from "./element-templates";
import type { ComposedSceneConfig, SceneControl, SceneStep } from "./types";

const STEP_INTERVAL_MS = 900; // matches graph-array-stepper's own autoplay cadence

// Effective params for one element: base params < current timeline step's
// overrides < live control values. Controls always win — they're the
// "what the reader is touching right now" layer, the same precedence
// trajectory-sandbox effectively gives its own speed/angle sliders over
// `config.initial`. Pure and exported (rather than an inline closure)
// specifically so this — the actual novel logic ComposedScene adds beyond
// "loop and call render()" — is unit-testable without a DOM, the same way
// components/site/theme-toggle.tsx exports its own pure `nextTheme` logic
// alongside the component for direct testing.
export function resolveElementParams(
  elementId: string,
  baseParams: ResolvedParams,
  currentStep: SceneStep | undefined,
  controls: SceneControl[] | undefined,
  controlValues: Record<string, number | boolean>,
): ResolvedParams {
  const stepOverrides = currentStep?.overrides[elementId] ?? {};
  const merged: ResolvedParams = { ...baseParams, ...stepOverrides };
  for (const control of controls ?? []) {
    if (control.bindsTo.elementId !== elementId) continue;
    const value = controlValues[control.id];
    if (value !== undefined) merged[control.bindsTo.paramKey] = value;
  }
  return merged;
}

// Merges the two rendering patterns FR-3/FR-4/A-2 both call for in one
// component: continuous, slider/control-driven rendering (like
// trajectory-sandbox) and an optional discrete timeline of steps (like
// graph-array-stepper) — because a composed scene can use either, neither,
// or both at once. This exact component is reused, unmodified, as the
// scene builder's live preview (NFR-1, SCENE-007) — nothing about its
// props or behavior may assume it's only ever reached via a published
// editorial page.
export function ComposedScene({ config }: { config: ComposedSceneConfig }) {
  const t = useTranslations("viz");

  const [width, setWidth] = useState(320);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // Live values from the reader's own slider/toggle interaction, keyed by
  // control id — separate from `config.elements[i].params` (the *base*
  // params), which are never mutated (SCENE-005 acceptance criterion:
  // "scrubbing the timeline applies the selected step's overrides without
  // mutating base params permanently").
  const [controlValues, setControlValues] = useState<Record<string, number | boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const steps = useMemo(() => config.steps ?? [], [config.steps]);
  const hasSteps = steps.length > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reset to the first step whenever a *different* config is supplied
  // (e.g. the scene builder's live preview re-rendering after an edit) —
  // otherwise a stale stepIndex could point past the end of a now-shorter
  // steps array.
  useEffect(() => {
    setStepIndex(0);
    setIsPlaying(false);
  }, [config]);

  // Autoplay through timeline steps. graph-array-stepper's own steps are
  // the same "discrete, author-authored sequence" shape (not a continuous
  // physics simulation like trajectory/orbital-sandbox's rAF loop), so this
  // mirrors that engine's setTimeout-per-step approach rather than
  // trajectory-sandbox's requestAnimationFrame one.
  useEffect(() => {
    if (!isPlaying || !hasSteps) return;
    if (stepIndex >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    const id = setTimeout(() => setStepIndex((i) => i + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [isPlaying, stepIndex, steps.length, hasSteps]);

  // A single, uniform design-space -> render-space scale factor, driven
  // only by the ResizeObserver-tracked width — same "one scale factor
  // applied to both x and y" approach trajectory-sandbox's own toPx() /
  // `scale` variable uses, just generalized (see element-templates.ts's
  // ScaleFns comment).
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

  const currentStep = hasSteps ? steps[Math.min(stepIndex, steps.length - 1)] : undefined;

  // Draw. Depends on `config` itself (not just its sub-fields) so a wholly
  // new config (e.g. the builder's live preview after an edit) always
  // triggers a redraw, even if some individual field happens to be `===`
  // across renders.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const ctx = setupCanvasForDpr(canvas, width, renderedHeight);
    if (!ctx) return;

    for (const element of config.elements) {
      const template = ELEMENT_TEMPLATES[element.templateId];
      // Defensive only: isComposedSceneConfig (types.ts) already rejects
      // any unrecognized templateId before a config reaches this
      // component (mirrors viz-engine.tsx's guard-then-render dispatch for
      // the other three engines).
      if (!template) continue;
      const resolved = resolveElementParams(
        element.id,
        element.params,
        currentStep,
        config.controls,
        controlValues,
      );
      template.render(ctx, resolved, scale);
    }
  }, [config, width, renderedHeight, scale, currentStep, controlValues]);

  function clampStep(next: number) {
    setStepIndex(Math.min(Math.max(next, 0), Math.max(steps.length - 1, 0)));
  }

  return (
    <div className="flex flex-col gap-4">
      {config.controls && config.controls.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {config.controls.map((control) => (
            <SceneControlField
              key={control.id}
              control={control}
              config={config}
              value={controlValues[control.id]}
              onChange={(value) =>
                setControlValues((prev) => ({ ...prev, [control.id]: value }))
              }
            />
          ))}
        </div>
      )}

      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" data-testid="composed-scene-canvas" />
      </div>

      {currentStep?.note && (
        <MarkdownText
          text={currentStep.note}
          className="text-sm text-slate-600 dark:text-slate-300"
        />
      )}

      {hasSteps && (
        <PlaybackControls
          current={stepIndex}
          total={Math.max(steps.length - 1, 0)}
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying((p) => !p)}
          onStep={(dir) => {
            setIsPlaying(false);
            clampStep(stepIndex + dir);
          }}
          onScrub={(v) => {
            setIsPlaying(false);
            clampStep(v);
          }}
          onReset={() => {
            setIsPlaying(false);
            setStepIndex(0);
          }}
          label={t("stepCounter", { current: stepIndex + 1, total: steps.length })}
        />
      )}
    </div>
  );
}

function SceneControlField({
  control,
  config,
  value,
  onChange,
}: {
  control: NonNullable<ComposedSceneConfig["controls"]>[number];
  config: ComposedSceneConfig;
  value: number | boolean | undefined;
  onChange: (value: number | boolean) => void;
}) {
  const targetElement = config.elements.find((e) => e.id === control.bindsTo.elementId);
  const template = targetElement ? ELEMENT_TEMPLATES[targetElement.templateId] : undefined;
  const paramSpec = template?.paramSchema.find((p) => p.key === control.bindsTo.paramKey);
  const baseValue = targetElement?.params[control.bindsTo.paramKey];

  if (control.kind === "toggle") {
    const current =
      typeof value === "boolean" ? value : typeof baseValue === "boolean" ? baseValue : Boolean(paramSpec?.default);
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={current}
          onChange={(e) => onChange(e.target.checked)}
        />
        {control.label}
      </label>
    );
  }

  const current =
    typeof value === "number"
      ? value
      : typeof baseValue === "number"
        ? baseValue
        : typeof paramSpec?.default === "number"
          ? paramSpec.default
          : 0;
  return (
    <label className="flex flex-col gap-1">
      <span className="label-code">{control.label}</span>
      <Slider
        min={control.min ?? paramSpec?.min ?? 0}
        max={control.max ?? paramSpec?.max ?? 100}
        step={control.step ?? paramSpec?.step ?? 1}
        value={[current]}
        onValueChange={([v]) => onChange(v ?? current)}
      />
    </label>
  );
}
