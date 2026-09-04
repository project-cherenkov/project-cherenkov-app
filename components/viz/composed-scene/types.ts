import { ELEMENT_TEMPLATES, type ElementTemplate, type ParamSpec } from "./element-templates";

// See element-templates.ts's own header comment for why vizConfig picks
// templates by id + bounded params rather than holding real render code —
// same constraint every other engine's types.ts already documents.

export interface SceneElement {
  /** Stable id, referenced by controls' bindsTo and steps' overrides. */
  id: string;
  /** Key into ELEMENT_TEMPLATES. */
  templateId: string;
  /** Optional author-facing name, shown in the scene builder's inspector. */
  label?: string;
  params: Record<string, number | string | boolean>;
}

export interface SceneControl {
  id: string;
  kind: "slider" | "toggle";
  label: string;
  bindsTo: { elementId: string; paramKey: string };
  min?: number; // sliders
  max?: number;
  step?: number;
}

export interface SceneStep {
  /** Markdown + KaTeX, per A-4 — rendered via components/viz/shared/markdown-text.tsx. */
  note?: string;
  // Sparse per-element overrides for this step — only changed params need
  // to be listed, same authoring ergonomics as graph-array-stepper's
  // steps[].pointers/highlight.
  overrides: Record<string /* elementId */, Record<string, number | string | boolean>>;
}

export interface ComposedSceneConfig {
  canvas: { widthPx: number; heightPx: number };
  elements: SceneElement[]; // capped, see MAX_ELEMENTS below (A-3)
  controls?: SceneControl[];
  steps?: SceneStep[]; // capped, see MAX_STEPS below (A-3); omitted = static scene
}

// A-3: soft caps enforced by this guard (not just a UI suggestion, per
// spec §9 risk R4's required mitigation), keeping the generic interpreter's
// performance predictable without hand-tuning per scene the way the three
// fixed engines are each hand-tuned today. Exported so the scene builder UI
// (SCENE-007) can disable "add" once a draft hits the cap, per spec §6's
// boundary-case requirement, without duplicating the numbers.
export const MAX_ELEMENTS = 12;
export const MAX_STEPS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

// Every KEY *present* in `params` must match a declared param on the
// template (right type, in-bounds) — this validates both a SceneElement's
// own (possibly partial) base params and a SceneStep's sparse per-element
// overrides with one function, since both are "some subset of this
// template's params, each one valid if present." Missing keys are not an
// error here; ComposedScene (SCENE-005) falls back to each param's
// declared `default` at render time, mirroring how graph-array-stepper's
// `pointers` can list any subset of named pointers.
function paramsMatchSchema(
  params: Record<string, unknown>,
  schema: ParamSpec[],
): boolean {
  const schemaByKey = new Map(schema.map((p) => [p.key, p]));
  for (const [key, value] of Object.entries(params)) {
    const spec = schemaByKey.get(key);
    if (!spec) return false; // unknown param key
    if (!paramValueValid(value, spec)) return false;
  }
  return true;
}

// Mirrors the existing engines' guards (e.g. isGraphArrayStepperConfig's
// per-step pointer validation, isTrajectorySandboxConfig's registered-key +
// range checks) in strictness: every templateId must be registered, every
// param present must match its template's declared type/bounds, and every
// elementId a control or step references must actually exist.
export function isComposedSceneConfig(
  config: unknown,
): config is ComposedSceneConfig {
  if (!isRecord(config)) return false;

  const canvas = config.canvas;
  if (!isRecord(canvas)) return false;
  if (
    typeof canvas.widthPx !== "number" ||
    !Number.isFinite(canvas.widthPx) ||
    canvas.widthPx <= 0 ||
    typeof canvas.heightPx !== "number" ||
    !Number.isFinite(canvas.heightPx) ||
    canvas.heightPx <= 0
  ) {
    return false;
  }

  if (!Array.isArray(config.elements)) return false;
  // Empty behaviour (spec §6): zero elements is a valid *draft* inside the
  // builder, but is rejected here — matching graph-array-stepper's
  // "steps must have length > 0" precedent — so a composed-scene editorial
  // can never end up published broken/empty.
  if (config.elements.length === 0 || config.elements.length > MAX_ELEMENTS) {
    return false;
  }

  const elementIds = new Set<string>();
  const templateByElementId = new Map<string, ElementTemplate>();
  for (const el of config.elements) {
    if (!isRecord(el)) return false;
    if (typeof el.id !== "string" || el.id.length === 0) return false;
    if (elementIds.has(el.id)) return false; // ids must be unique
    if (typeof el.templateId !== "string") return false;
    const template = ELEMENT_TEMPLATES[el.templateId];
    if (!template) return false; // unrecognized templateId
    if (el.label !== undefined && typeof el.label !== "string") return false;
    if (!isRecord(el.params)) return false;
    if (!paramsMatchSchema(el.params, template.paramSchema)) return false;

    elementIds.add(el.id);
    templateByElementId.set(el.id, template);
  }

  if (config.controls !== undefined) {
    if (!Array.isArray(config.controls)) return false;
    for (const ctrl of config.controls) {
      if (!isRecord(ctrl)) return false;
      if (typeof ctrl.id !== "string" || ctrl.id.length === 0) return false;
      if (ctrl.kind !== "slider" && ctrl.kind !== "toggle") return false;
      if (typeof ctrl.label !== "string") return false;
      if (!isRecord(ctrl.bindsTo)) return false;
      const { elementId, paramKey } = ctrl.bindsTo;
      if (typeof elementId !== "string" || !elementIds.has(elementId)) return false;
      if (typeof paramKey !== "string") return false;
      const template = templateByElementId.get(elementId);
      if (!template) return false; // unreachable given the elementIds.has check above; keeps TS's noUncheckedIndexedAccess happy
      const paramSpec = template.paramSchema.find((p) => p.key === paramKey);
      if (!paramSpec) return false; // dangling paramKey
      if (ctrl.kind === "slider" && paramSpec.type !== "number") return false;
      if (ctrl.kind === "toggle" && paramSpec.type !== "boolean") return false;
      if (ctrl.min !== undefined && typeof ctrl.min !== "number") return false;
      if (ctrl.max !== undefined && typeof ctrl.max !== "number") return false;
      if (ctrl.step !== undefined && typeof ctrl.step !== "number") return false;
    }
  }

  if (config.steps !== undefined) {
    if (!Array.isArray(config.steps)) return false;
    if (config.steps.length > MAX_STEPS) return false;
    for (const step of config.steps) {
      if (!isRecord(step)) return false;
      if (step.note !== undefined && typeof step.note !== "string") return false;
      if (!isRecord(step.overrides)) return false;
      for (const [elId, overrideParams] of Object.entries(step.overrides)) {
        if (!elementIds.has(elId)) return false; // dangling elementId reference
        if (!isRecord(overrideParams)) return false;
        const template = templateByElementId.get(elId);
        if (!template) return false; // unreachable given the elementIds.has check above; keeps TS's noUncheckedIndexedAccess happy
        if (!paramsMatchSchema(overrideParams, template.paramSchema)) return false;
      }
    }
  }

  return true;
}
