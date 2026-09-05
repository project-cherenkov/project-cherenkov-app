import { describe, expect, it } from "vitest";
import { isComposedSceneConfig, MAX_ELEMENTS, MAX_STEPS } from "./types";
import type { ComposedSceneConfig } from "./types";

function baseConfig(): ComposedSceneConfig {
  return {
    canvas: { widthPx: 320, heightPx: 200 },
    elements: [
      { id: "el-1", templateId: "shape-circle", params: { x: 60, y: 60, radius: 20, color: "blue" } },
    ],
  };
}

describe("isComposedSceneConfig", () => {
  it("accepts a minimal valid config", () => {
    expect(isComposedSceneConfig(baseConfig())).toBe(true);
  });

  it("accepts a config with controls and steps", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [
        { id: "marker", templateId: "slider-marker", params: { x: 40, y: 40, radius: 8 } },
      ],
      controls: [
        {
          id: "ctrl-1",
          kind: "slider",
          label: "Position",
          bindsTo: { elementId: "marker", paramKey: "x" },
          min: 0,
          max: 200,
          step: 1,
        },
      ],
      steps: [
        { note: "Step one", overrides: { marker: { x: 10 } } },
        { note: "Step two", overrides: { marker: { x: 90 } } },
      ],
    };
    expect(isComposedSceneConfig(config)).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(isComposedSceneConfig(null)).toBe(false);
    expect(isComposedSceneConfig(undefined)).toBe(false);
    expect(isComposedSceneConfig("scene")).toBe(false);
    expect(isComposedSceneConfig(42)).toBe(false);
  });

  it("rejects a missing or malformed canvas", () => {
    const config = baseConfig() as unknown as Record<string, unknown>;
    delete config.canvas;
    expect(isComposedSceneConfig(config)).toBe(false);

    expect(
      isComposedSceneConfig({ ...baseConfig(), canvas: { widthPx: 0, heightPx: 200 } }),
    ).toBe(false);
    expect(
      isComposedSceneConfig({ ...baseConfig(), canvas: { widthPx: 320, heightPx: -1 } }),
    ).toBe(false);
  });

  it("rejects an empty-elements scene (spec §6: valid draft, invalid published config)", () => {
    const config = { ...baseConfig(), elements: [] };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("accepts exactly MAX_ELEMENTS and rejects one over the cap (A-3)", () => {
    const atCap: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: Array.from({ length: MAX_ELEMENTS }, (_, i) => ({
        id: `el-${i}`,
        templateId: "shape-circle",
        params: { x: 10, y: 10, radius: 5, color: "blue" },
      })),
    };
    expect(isComposedSceneConfig(atCap)).toBe(true);

    const overCap: ComposedSceneConfig = {
      ...atCap,
      elements: [
        ...atCap.elements,
        { id: "el-extra", templateId: "shape-circle", params: { x: 10, y: 10, radius: 5, color: "blue" } },
      ],
    };
    expect(isComposedSceneConfig(overCap)).toBe(false);
  });

  it("accepts exactly MAX_STEPS and rejects one over the cap (A-3)", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: {} }],
      steps: Array.from({ length: MAX_STEPS }, () => ({ overrides: {} })),
    };
    expect(isComposedSceneConfig(config)).toBe(true);

    const overCap = { ...config, steps: [...config.steps!, { overrides: {} }] };
    expect(isComposedSceneConfig(overCap)).toBe(false);
  });

  it("rejects duplicate element ids", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [
        { id: "dup", templateId: "shape-circle", params: {} },
        { id: "dup", templateId: "shape-rect", params: {} },
      ],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("rejects an unrecognized templateId", () => {
    const config = {
      ...baseConfig(),
      elements: [{ id: "el-1", templateId: "not-a-real-template", params: {} }],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("rejects a control whose bindsTo.elementId does not exist", () => {
    const config: ComposedSceneConfig = {
      ...baseConfig(),
      controls: [
        {
          id: "ctrl-1",
          kind: "slider",
          label: "Radius",
          bindsTo: { elementId: "does-not-exist", paramKey: "radius" },
        },
      ],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("rejects a control whose bindsTo.paramKey isn't on the target template", () => {
    const config: ComposedSceneConfig = {
      ...baseConfig(),
      controls: [
        {
          id: "ctrl-1",
          kind: "slider",
          label: "Nonexistent",
          bindsTo: { elementId: "el-1", paramKey: "not-a-param" },
        },
      ],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("rejects a slider control bound to a non-number param, and a toggle bound to a non-boolean param", () => {
    const sliderOnSelect: ComposedSceneConfig = {
      ...baseConfig(),
      controls: [
        { id: "c1", kind: "slider", label: "Color", bindsTo: { elementId: "el-1", paramKey: "color" } },
      ],
    };
    expect(isComposedSceneConfig(sliderOnSelect)).toBe(false);

    const toggleOnNumber: ComposedSceneConfig = {
      ...baseConfig(),
      controls: [
        { id: "c1", kind: "toggle", label: "Radius", bindsTo: { elementId: "el-1", paramKey: "radius" } },
      ],
    };
    expect(isComposedSceneConfig(toggleOnNumber)).toBe(false);
  });

  it("rejects a step overrides entry whose elementId does not exist", () => {
    const config: ComposedSceneConfig = {
      ...baseConfig(),
      steps: [{ overrides: { "does-not-exist": { radius: 5 } } }],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("rejects an out-of-bounds param value", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: { radius: 9999 } }],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("rejects a wrong-typed param value", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: { radius: "big" as unknown as number } }],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("rejects a select param value outside its declared options", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: { color: "chartreuse" } }],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });

  it("accepts a param value at exactly its declared min/max boundary (inclusive)", () => {
    const atMin: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: { radius: 1 } }],
    };
    expect(isComposedSceneConfig(atMin)).toBe(true);

    const atMax: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: { radius: 300 } }],
    };
    expect(isComposedSceneConfig(atMax)).toBe(true);
  });

  it("allows an element's params to be a partial subset of its template's schema", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: { radius: 15 } }],
    };
    expect(isComposedSceneConfig(config)).toBe(true);
  });

  it("rejects an unknown param key not declared on the template", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: { madeUpKey: 1 } }],
    };
    expect(isComposedSceneConfig(config)).toBe(false);
  });
});
