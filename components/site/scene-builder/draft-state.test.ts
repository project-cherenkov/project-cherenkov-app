import { describe, expect, it } from "vitest";
import { isComposedSceneConfig, MAX_ELEMENTS, MAX_STEPS } from "@/components/viz/composed-scene/types";
import {
  addControl,
  addElement,
  addStep,
  clearStepOverrideElement,
  createEmptyDraft,
  isAtElementCap,
  isAtStepCap,
  moveStep,
  removeControl,
  removeElement,
  removeStep,
  setStepOverrideParam,
  toPublishableConfig,
  updateElementLabel,
  updateElementParam,
  updateStepNote,
} from "./draft-state";

describe("createEmptyDraft / toPublishableConfig", () => {
  it("an empty draft has zero elements and publishes without controls/steps", () => {
    const draft = createEmptyDraft();
    expect(draft.elements).toHaveLength(0);
    const config = toPublishableConfig(draft);
    expect(config.controls).toBeUndefined();
    expect(config.steps).toBeUndefined();
    // Empty behaviour (spec §6): a zero-element draft is valid *within the
    // builder* but must fail isComposedSceneConfig — it should never be
    // possible to save this.
    expect(isComposedSceneConfig(config)).toBe(false);
  });
});

describe("addElement / removeElement", () => {
  it("adds an element with the template's default params and a unique id", () => {
    const draft = addElement(createEmptyDraft(), "shape-circle");
    expect(draft.elements).toHaveLength(1);
    expect(draft.elements[0]?.templateId).toBe("shape-circle");
    expect(draft.elements[0]?.params.radius).toBe(20);
  });

  it("is a no-op for an unrecognized templateId", () => {
    const draft = addElement(createEmptyDraft(), "not-a-real-template");
    expect(draft.elements).toHaveLength(0);
  });

  it("refuses to add past MAX_ELEMENTS", () => {
    let draft = createEmptyDraft();
    for (let i = 0; i < MAX_ELEMENTS; i++) {
      draft = addElement(draft, "shape-circle");
    }
    expect(draft.elements).toHaveLength(MAX_ELEMENTS);
    expect(isAtElementCap(draft)).toBe(true);
    draft = addElement(draft, "shape-circle");
    expect(draft.elements).toHaveLength(MAX_ELEMENTS); // unchanged — still capped
  });

  it("a config at exactly the cap is valid; one over is not", () => {
    let atCap = createEmptyDraft();
    for (let i = 0; i < MAX_ELEMENTS; i++) atCap = addElement(atCap, "shape-circle");
    expect(isComposedSceneConfig(toPublishableConfig(atCap))).toBe(true);

    // Construct an over-cap config directly (bypassing the reducer's own
    // cap guard) to prove the *type guard* enforces the cap independently,
    // not just the builder UI/reducers (spec §9 R4: "implement caps in
    // isComposedSceneConfig, not just as a UI suggestion").
    const overCap = toPublishableConfig(atCap);
    overCap.elements = [...overCap.elements, { id: "one-too-many", templateId: "shape-circle", params: {} }];
    expect(isComposedSceneConfig(overCap)).toBe(false);
  });

  it("removeElement drops the element and any controls/step-overrides referencing it", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const elementId = draft.elements[0]!.id;
    draft = addControl(draft, elementId, "radius", "Radius");
    draft = addStep(draft);
    draft = setStepOverrideParam(draft, 0, elementId, "radius", 40);

    draft = removeElement(draft, elementId);

    expect(draft.elements).toHaveLength(0);
    expect(draft.controls).toHaveLength(0);
    expect(draft.steps[0]?.overrides).toEqual({});
  });
});

describe("updateElementParam", () => {
  it("accepts an in-bounds value", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = updateElementParam(draft, id, "radius", 50);
    expect(draft.elements[0]?.params.radius).toBe(50);
  });

  it("rejects an out-of-bounds value (radius max is 300)", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = updateElementParam(draft, id, "radius", 999);
    expect(draft.elements[0]?.params.radius).toBe(20); // unchanged default
  });

  it("rejects a wrong-typed value", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = updateElementParam(draft, id, "radius", "fifty" as unknown as number);
    expect(draft.elements[0]?.params.radius).toBe(20);
  });

  it("rejects an unlisted select option", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = updateElementParam(draft, id, "color", "ultraviolet");
    expect(draft.elements[0]?.params.color).toBe("blue");
  });

  it("accepts a bounded text value and rejects one over maxLength", () => {
    let draft = addElement(createEmptyDraft(), "text-label");
    const id = draft.elements[0]!.id;
    draft = updateElementParam(draft, id, "text", "Hello");
    expect(draft.elements[0]?.params.text).toBe("Hello");
    draft = updateElementParam(draft, id, "text", "x".repeat(61)); // maxLength is 60
    expect(draft.elements[0]?.params.text).toBe("Hello"); // unchanged
  });
});

describe("updateElementLabel", () => {
  it("sets and clears an author-facing label", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = updateElementLabel(draft, id, "The sun");
    expect(draft.elements[0]?.label).toBe("The sun");
    draft = updateElementLabel(draft, id, "");
    expect(draft.elements[0]?.label).toBeUndefined();
  });
});

describe("addStep / removeStep / moveStep / updateStepNote", () => {
  it("adds steps up to MAX_STEPS and then refuses", () => {
    let draft = createEmptyDraft();
    for (let i = 0; i < MAX_STEPS; i++) draft = addStep(draft);
    expect(draft.steps).toHaveLength(MAX_STEPS);
    expect(isAtStepCap(draft)).toBe(true);
    draft = addStep(draft);
    expect(draft.steps).toHaveLength(MAX_STEPS);
  });

  it("reorders adjacent steps and leaves out-of-range moves unchanged", () => {
    let draft = createEmptyDraft();
    draft = updateStepNote(addStep(draft), 0, "first");
    draft = updateStepNote(addStep(draft), 1, "second");

    const moved = moveStep(draft, 0, 1);
    expect(moved.steps.map((s) => s.note)).toEqual(["second", "first"]);

    const unchanged = moveStep(draft, 0, -1); // already at index 0
    expect(unchanged.steps.map((s) => s.note)).toEqual(["first", "second"]);
  });

  it("removeStep drops exactly the targeted step", () => {
    let draft = createEmptyDraft();
    draft = updateStepNote(addStep(draft), 0, "keep");
    draft = updateStepNote(addStep(draft), 1, "drop");
    draft = removeStep(draft, 1);
    expect(draft.steps.map((s) => s.note)).toEqual(["keep"]);
  });
});

describe("setStepOverrideParam / clearStepOverrideElement", () => {
  it("sets a valid override without mutating the element's base params", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = addStep(draft);
    draft = setStepOverrideParam(draft, 0, id, "radius", 80);

    expect(draft.steps[0]?.overrides[id]?.radius).toBe(80);
    expect(draft.elements[0]?.params.radius).toBe(20); // base param untouched
  });

  it("rejects an out-of-bounds override", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = addStep(draft);
    draft = setStepOverrideParam(draft, 0, id, "radius", 9999);
    expect(draft.steps[0]?.overrides[id]).toBeUndefined();
  });

  it("clearStepOverrideElement removes the whole per-element entry", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = addStep(draft);
    draft = setStepOverrideParam(draft, 0, id, "radius", 80);
    draft = clearStepOverrideElement(draft, 0, id);
    expect(draft.steps[0]?.overrides[id]).toBeUndefined();
  });

  it("rejects a step whose overrides reference a non-existent element (isComposedSceneConfig)", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    draft = addStep(draft);
    const config = toPublishableConfig(draft);
    // Hand-construct a dangling reference the reducers themselves would
    // never produce, to prove the guard independently catches it.
    config.steps = [{ overrides: { "no-such-element": { radius: 10 } } }];
    expect(isComposedSceneConfig(config)).toBe(false);
  });
});

describe("addControl / removeControl", () => {
  it("adds a slider control for a number param", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = addControl(draft, id, "radius", "Radius");
    expect(draft.controls).toHaveLength(1);
    expect(draft.controls[0]?.kind).toBe("slider");
    expect(draft.controls[0]?.bindsTo).toEqual({ elementId: id, paramKey: "radius" });
  });

  it("is a no-op for a param that doesn't exist on the template", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = addControl(draft, id, "not-a-real-param", "Whatever");
    expect(draft.controls).toHaveLength(0);
  });

  it("is a no-op for a select/text param (only number/boolean bind to controls)", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = addControl(draft, id, "color", "Color");
    expect(draft.controls).toHaveLength(0);
  });

  it("removeControl removes exactly the targeted control", () => {
    let draft = addElement(createEmptyDraft(), "shape-circle");
    const id = draft.elements[0]!.id;
    draft = addControl(draft, id, "radius", "Radius");
    const controlId = draft.controls[0]!.id;
    draft = removeControl(draft, controlId);
    expect(draft.controls).toHaveLength(0);
  });
});

describe("end-to-end draft -> publishable config", () => {
  it("a scene combining two different templates plus a timeline passes isComposedSceneConfig", () => {
    let draft = createEmptyDraft();
    draft = addElement(draft, "curve-sine");
    draft = addElement(draft, "slider-marker");
    const markerId = draft.elements[1]!.id;
    draft = addControl(draft, markerId, "y", "Marker height");
    draft = addStep(draft);
    draft = updateStepNote(draft, 0, "**Start** at $t=0$");
    draft = setStepOverrideParam(draft, 0, markerId, "y", 90);
    draft = addStep(draft);
    draft = setStepOverrideParam(draft, 1, markerId, "y", 10);

    const config = toPublishableConfig(draft);
    expect(isComposedSceneConfig(config)).toBe(true);
    expect(config.elements).toHaveLength(2);
    expect(config.steps).toHaveLength(2);
    expect(config.controls).toHaveLength(1);
  });
});
