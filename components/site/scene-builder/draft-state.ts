import {
  ELEMENT_TEMPLATES,
  type ParamSpec,
} from "@/components/viz/composed-scene/element-templates";
import {
  MAX_ELEMENTS,
  MAX_STEPS,
  type ComposedSceneConfig,
  type SceneControl,
  type SceneElement,
  type SceneStep,
} from "@/components/viz/composed-scene/types";

// The in-progress scene, as edited by the builder page. Structurally a
// ComposedSceneConfig, plus one extra field (`nextSeq`) that only exists
// while authoring: a monotonic counter used to generate stable, unique
// element/control ids without pulling in crypto.randomUUID (keeps id
// generation deterministic and trivially testable). `controls`/`steps` are
// always present as arrays here (never undefined) so every reducer below
// has one shape to work with; `toPublishableConfig` strips them back down
// to "omitted entirely = static scene" (spec §6) before saving.
export interface SceneBuilderDraft {
  canvas: { widthPx: number; heightPx: number };
  elements: SceneElement[];
  controls: SceneControl[];
  steps: SceneStep[];
  nextSeq: number;
}

const DEFAULT_CANVAS = { widthPx: 320, heightPx: 200 };

// Object.entries/fromEntries rather than destructuring-and-discarding a
// key, which would otherwise leave an intentionally-unused binding behind
// (the kind of thing next lint's no-unused-vars already flags elsewhere in
// this repo's test files — not a pattern to add to here).
function withoutKey<V>(obj: Record<string, V>, key: string): Record<string, V> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

export function createEmptyDraft(
  canvas: { widthPx: number; heightPx: number } = DEFAULT_CANVAS,
): SceneBuilderDraft {
  return { canvas, elements: [], controls: [], steps: [], nextSeq: 1 };
}

export function isAtElementCap(draft: SceneBuilderDraft): boolean {
  return draft.elements.length >= MAX_ELEMENTS;
}

export function isAtStepCap(draft: SceneBuilderDraft): boolean {
  return draft.steps.length >= MAX_STEPS;
}

function defaultParams(templateId: string): Record<string, number | string | boolean> {
  const template = ELEMENT_TEMPLATES[templateId];
  if (!template) return {};
  const params: Record<string, number | string | boolean> = {};
  for (const spec of template.paramSchema) {
    params[spec.key] = spec.default;
  }
  return params;
}

function findParamSpec(templateId: string, key: string): ParamSpec | undefined {
  return ELEMENT_TEMPLATES[templateId]?.paramSchema.find((p) => p.key === key);
}

// A-3 boundary case (spec §6): "hitting the cap disables 'add' ... rather
// than allowing the draft to exceed the cap." Enforced here too (not just
// in the UI's disabled-button state) so a caller can never construct an
// over-cap draft by calling this directly.
export function addElement(draft: SceneBuilderDraft, templateId: string): SceneBuilderDraft {
  if (isAtElementCap(draft)) return draft;
  if (!ELEMENT_TEMPLATES[templateId]) return draft; // unknown templateId — no-op
  const id = `el${draft.nextSeq}`;
  const element: SceneElement = { id, templateId, params: defaultParams(templateId) };
  return { ...draft, elements: [...draft.elements, element], nextSeq: draft.nextSeq + 1 };
}

// Removing an element also drops anything that referenced it — a dangling
// control.bindsTo.elementId or step.overrides[elementId] would otherwise
// fail isComposedSceneConfig at save time with no obvious cause in the UI.
export function removeElement(draft: SceneBuilderDraft, elementId: string): SceneBuilderDraft {
  return {
    ...draft,
    elements: draft.elements.filter((el) => el.id !== elementId),
    controls: draft.controls.filter((c) => c.bindsTo.elementId !== elementId),
    steps: draft.steps.map((step) => {
      if (!(elementId in step.overrides)) return step;
      return { ...step, overrides: withoutKey(step.overrides, elementId) };
    }),
  };
}

export function updateElementLabel(
  draft: SceneBuilderDraft,
  elementId: string,
  label: string,
): SceneBuilderDraft {
  return {
    ...draft,
    elements: draft.elements.map((el) =>
      el.id === elementId ? { ...el, label: label.length > 0 ? label : undefined } : el,
    ),
  };
}

// Validates against the template's declared ParamSpec before accepting the
// value (FR-2/§6: "every parameter is validated against its template's
// declared type/min/max before it can be added to the draft scene
// (client-side, immediate feedback)"). An invalid value is silently
// rejected (the base param keeps its previous value) rather than stored
// and only caught at save time — the form fields themselves also constrain
// input range/options, so this is defense-in-depth, not the only check.
export function updateElementParam(
  draft: SceneBuilderDraft,
  elementId: string,
  key: string,
  value: number | string | boolean,
): SceneBuilderDraft {
  return {
    ...draft,
    elements: draft.elements.map((el) => {
      if (el.id !== elementId) return el;
      const spec = findParamSpec(el.templateId, key);
      if (!spec || !paramValueValid(value, spec)) return el;
      return { ...el, params: { ...el.params, [key]: value } };
    }),
  };
}

function paramValueValid(value: unknown, spec: ParamSpec): boolean {
  switch (spec.type) {
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return false;
      if (spec.min !== undefined && value < spec.min) return false;
      if (spec.max !== undefined && value > spec.max) return false;
      return true;
    case "boolean":
      return typeof value === "boolean";
    case "select":
      return typeof value === "string" && (spec.options ?? []).includes(value);
    case "text":
      if (typeof value !== "string") return false;
      if (spec.maxLength !== undefined && value.length > spec.maxLength) return false;
      return true;
    default:
      return false;
  }
}

export function addStep(draft: SceneBuilderDraft): SceneBuilderDraft {
  if (isAtStepCap(draft)) return draft;
  const step: SceneStep = { overrides: {} };
  return { ...draft, steps: [...draft.steps, step] };
}

export function removeStep(draft: SceneBuilderDraft, index: number): SceneBuilderDraft {
  return { ...draft, steps: draft.steps.filter((_, i) => i !== index) };
}

// Adjacent swap — the timeline editor exposes this as "move up"/"move
// down" per step, which is all the spec's "add/reorder/remove timeline
// steps" acceptance criterion (§11 SCENE-007) requires.
export function moveStep(
  draft: SceneBuilderDraft,
  index: number,
  direction: -1 | 1,
): SceneBuilderDraft {
  const target = index + direction;
  if (index < 0 || index >= draft.steps.length) return draft;
  if (target < 0 || target >= draft.steps.length) return draft;
  const steps = [...draft.steps];
  const a = steps[index];
  const b = steps[target];
  if (!a || !b) return draft; // unreachable given the bounds checks above; keeps noUncheckedIndexedAccess happy
  steps[index] = b;
  steps[target] = a;
  return { ...draft, steps };
}

export function updateStepNote(
  draft: SceneBuilderDraft,
  index: number,
  note: string,
): SceneBuilderDraft {
  return {
    ...draft,
    steps: draft.steps.map((step, i) =>
      i === index ? { ...step, note: note.length > 0 ? note : undefined } : step,
    ),
  };
}

// Sets one overridden param for one element within one step. Only called
// with keys/values already constrained by the auto-generated form (same
// paramSchema as the element's own base params), but validated again here
// for the same defense-in-depth reason as updateElementParam.
export function setStepOverrideParam(
  draft: SceneBuilderDraft,
  stepIndex: number,
  elementId: string,
  key: string,
  value: number | string | boolean,
): SceneBuilderDraft {
  const element = draft.elements.find((el) => el.id === elementId);
  if (!element) return draft;
  const spec = findParamSpec(element.templateId, key);
  if (!spec || !paramValueValid(value, spec)) return draft;
  return {
    ...draft,
    steps: draft.steps.map((step, i) => {
      if (i !== stepIndex) return step;
      const existing = step.overrides[elementId] ?? {};
      return {
        ...step,
        overrides: { ...step.overrides, [elementId]: { ...existing, [key]: value } },
      };
    }),
  };
}

// Stops overriding a given element within a given step entirely (the
// inspector's "revert to base for this step" action), as distinct from
// clearing one param — this removes the whole per-element override entry.
export function clearStepOverrideElement(
  draft: SceneBuilderDraft,
  stepIndex: number,
  elementId: string,
): SceneBuilderDraft {
  return {
    ...draft,
    steps: draft.steps.map((step, i) => {
      if (i !== stepIndex) return step;
      if (!(elementId in step.overrides)) return step;
      return { ...step, overrides: withoutKey(step.overrides, elementId) };
    }),
  };
}

// Adds a slider (number param) or toggle (boolean param) control bound to
// one element's param — the kind is derived from the param's declared
// type, not chosen independently, since isComposedSceneConfig rejects a
// slider bound to a non-number param (and a toggle bound to a non-boolean
// one).
export function addControl(
  draft: SceneBuilderDraft,
  elementId: string,
  paramKey: string,
  label: string,
): SceneBuilderDraft {
  const element = draft.elements.find((el) => el.id === elementId);
  if (!element) return draft;
  const spec = findParamSpec(element.templateId, paramKey);
  if (!spec) return draft;
  if (spec.type !== "number" && spec.type !== "boolean") return draft;
  const control: SceneControl = {
    id: `ctrl${draft.nextSeq}`,
    kind: spec.type === "number" ? "slider" : "toggle",
    label: label.length > 0 ? label : spec.label,
    bindsTo: { elementId, paramKey },
    ...(spec.type === "number" ? { min: spec.min, max: spec.max, step: spec.step } : {}),
  };
  return { ...draft, controls: [...draft.controls, control], nextSeq: draft.nextSeq + 1 };
}

export function removeControl(draft: SceneBuilderDraft, controlId: string): SceneBuilderDraft {
  return { ...draft, controls: draft.controls.filter((c) => c.id !== controlId) };
}

// Converts the authoring draft into the actual ComposedSceneConfig shape
// that gets posted to /api/scene-builder — dropping the authoring-only
// `nextSeq` counter and omitting `controls`/`steps` when empty so an
// element-only draft round-trips as a genuinely static scene (spec §6:
// "a scene with elements but no steps is valid and renders as a static
// (non-timeline) scene"), matching how ComposedScene itself treats an
// empty/undefined steps array identically.
export function toPublishableConfig(draft: SceneBuilderDraft): ComposedSceneConfig {
  const config: ComposedSceneConfig = {
    canvas: draft.canvas,
    elements: draft.elements,
  };
  if (draft.controls.length > 0) config.controls = draft.controls;
  if (draft.steps.length > 0) config.steps = draft.steps;
  return config;
}
