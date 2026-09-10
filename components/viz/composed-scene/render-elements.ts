import { ELEMENT_TEMPLATES } from "./element-templates";
import type { ResolvedParams, ScaleFns } from "./element-templates";
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
