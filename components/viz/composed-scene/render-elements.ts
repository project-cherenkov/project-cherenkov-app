import { ELEMENT_TEMPLATES } from "./element-templates";
import type { ParamSpec, ResolvedParams, ScaleFns } from "./element-templates";
import type { SceneControl, SceneElement, SceneStep } from "./types";

// Effective params for one element: base params < current timeline step's
// overrides < live control values. Controls always win — they're the
// "what the reader is touching right now" layer, the same precedence
// trajectory-sandbox effectively gives its own speed/angle sliders over
// `config.initial`. Pure and exported (rather than an inline closure)
// specifically so this — the actual novel logic ComposedScene adds beyond
// "loop and call render()" — is unit-testable without a DOM, the same way
// components/site/theme-toggle.tsx exports its own pure `nextTheme` logic
// alongside the component for direct testing.
//
// Originally defined inline in index.tsx; moved here (PROG-002) alongside
// renderElements below, which depends on it — index.tsx re-exports it so
// its own existing test (`import { resolveElementParams } from "./index"`)
// needed no changes (PROG-R4: the extraction must be behavior-preserving,
// verified by that test suite passing unmodified).
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

// The actual per-frame render loop: for each element, look up its
// template, resolve its effective params, and draw it. Extracted out of
// ComposedScene (PROG-002) so it's reused verbatim by
// programmable-scene/index.tsx's own rAF loop — a programmable scene's
// elements come from interpreter.ts's per-tick output rather than a static
// `config.elements` array, but once that array exists, drawing it is
// exactly this same loop; duplicating it would let the two engines'
// rendering drift apart over time for no reason. A programmable scene has
// no timeline steps or SceneControl bindings of its own (its controls are
// read directly by the program itself via `{ kind: "input", name:
// "control:<id>" }` in interpreter.ts, not bound to a paramKey here) — it
// calls this with `controls: undefined`, `controlValues: {}`,
// `currentStep: undefined`, which makes resolveElementParams above a
// harmless no-op passthrough of each element's already-fully-resolved
// params.
export function renderElements(
  ctx: CanvasRenderingContext2D,
  elements: SceneElement[],
  controls: SceneControl[] | undefined,
  controlValues: Record<string, number | boolean>,
  currentStep: SceneStep | undefined,
  scale: ScaleFns,
): void {
  for (const element of elements) {
    const template = ELEMENT_TEMPLATES[element.templateId];
    // Defensive only: isComposedSceneConfig (types.ts) already rejects any
    // unrecognized templateId before a composed-scene config reaches this
    // loop (mirrors viz-engine.tsx's guard-then-render dispatch for the
    // other engines); for programmable-scene, interpreter.ts's own
    // isProgrammableSceneConfig validation only guarantees a *published*
    // program's emitElement templateIds are real — this same guard also
    // covers a config that was hand-edited or otherwise bypassed
    // validation.
    if (!template) continue;
    const resolved = resolveElementParams(element.id, element.params, currentStep, controls, controlValues);
    template.render(ctx, resolved, scale);
  }
}

// Ease-in-out (smoothstep): 0 -> 0, 1 -> 1, symmetric about 0.5, flat at both
// ends so a glide starts and settles gently instead of moving at constant
// speed. Exported for tests.
export function easeInOut(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

// The value an element's param has *while a given step is showing*: that
// step's own override if it lists one, otherwise the element's base param,
// otherwise the template's declared default — the same fallback chain
// resolveElementParams plus each template's own `num(params, key, fallback)`
// effectively apply at render time. Steps are NOT cumulative (an override
// applies only while its own step is current), so the "from" and "to" values
// of a glide are each computed independently against base.
function valueDuringStep(
  step: SceneStep | undefined,
  element: SceneElement,
  spec: ParamSpec,
): number | string | boolean {
  const override = step?.overrides[element.id]?.[spec.key];
  if (override !== undefined) return override;
  const base = element.params[spec.key];
  if (base !== undefined) return base;
  return spec.default;
}

// R1 (docs/design/visualization-interactions.md): the params to draw while
// gliding from `fromStep` to `toStep`, `t` in [0, 1] (clamped).
//
// Returns a synthetic SceneStep holding, for every param either step
// overrides, the interpolated value; params neither step touches are
// omitted, so they keep resolving to base exactly as before. Because the
// result is itself a SceneStep, it can be passed straight to renderElements
// as `currentStep`, and live control values keep their higher precedence in
// resolveElementParams with no further change. Feeding a previous result
// back in as `fromStep` is also valid — that is how an animation that is
// interrupted mid-glide restarts from what is on screen, not from the step
// that was heading away.
//
//   - numbers: linear interpolation with ease-in-out applied to t, clamped
//     to the param's declared min/max (both endpoints are already valid and
//     interpolation is convex, so the clamp is a belt-and-braces guarantee
//     that a glide can never leave a template's bounds);
//   - booleans, strings and selects cannot be blended: they switch at t >= 0.5.
//
// t <= 0 returns the "from" values and t >= 1 the "to" values exactly (no
// floating-point residue from the lerp). Pure: never mutates its arguments
// or any element's base params.
export function interpolateStepOverrides(
  elements: SceneElement[],
  fromStep: SceneStep | undefined,
  toStep: SceneStep | undefined,
  t: number,
): SceneStep {
  const overrides: SceneStep["overrides"] = {};
  const eased = easeInOut(t);

  for (const element of elements) {
    const template = ELEMENT_TEMPLATES[element.templateId];
    if (!template) continue;

    const keys = new Set([
      ...Object.keys(fromStep?.overrides[element.id] ?? {}),
      ...Object.keys(toStep?.overrides[element.id] ?? {}),
    ]);
    if (keys.size === 0) continue;

    const result: ResolvedParams = {};
    for (const key of keys) {
      const spec = template.paramSchema.find((p) => p.key === key);
      if (!spec) continue; // unknown key: the guard rejects these; skip defensively
      const from = valueDuringStep(fromStep, element, spec);
      const to = valueDuringStep(toStep, element, spec);

      if (t <= 0) {
        result[key] = from;
      } else if (t >= 1) {
        result[key] = to;
      } else if (typeof from === "number" && typeof to === "number") {
        let value = from + (to - from) * eased;
        if (spec.min !== undefined) value = Math.max(value, spec.min);
        if (spec.max !== undefined) value = Math.min(value, spec.max);
        result[key] = value;
      } else {
        result[key] = t >= 0.5 ? to : from;
      }
    }
    overrides[element.id] = result;
  }

  return { overrides };
}
