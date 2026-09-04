import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Same render-test convention as the rest of this repo's component tests
// (renderToStaticMarkup + string assertions, next-intl mocked to an
// identity translator) — see components/viz/graph-array-stepper/index.test.tsx
// for the same pattern applied to another viz engine.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { ComposedScene, resolveElementParams } from "./index";
import type { ComposedSceneConfig, SceneControl, SceneStep } from "./types";

describe("resolveElementParams (SCENE-005 acceptance criteria)", () => {
  const baseParams = { x: 10, y: 20, radius: 5 };

  it("returns the base params unchanged when there is no step and no bound control", () => {
    expect(resolveElementParams("el-1", baseParams, undefined, undefined, {})).toEqual(baseParams);
  });

  it("applies the current step's overrides on top of base params, without mutating the base object", () => {
    const step: SceneStep = { overrides: { "el-1": { radius: 99 } } };
    const result = resolveElementParams("el-1", baseParams, step, undefined, {});

    expect(result).toEqual({ x: 10, y: 20, radius: 99 });
    // Base params object itself must be untouched (SCENE-005: "without
    // mutating base params permanently").
    expect(baseParams).toEqual({ x: 10, y: 20, radius: 5 });
  });

  it("ignores a step's overrides for a different element entirely", () => {
    const step: SceneStep = { overrides: { "some-other-element": { radius: 99 } } };
    expect(resolveElementParams("el-1", baseParams, step, undefined, {})).toEqual(baseParams);
  });

  it("a bound control updates only its own bound param on its own element (not other params, not other elements)", () => {
    const controls: SceneControl[] = [
      { id: "ctrl-radius", kind: "slider", label: "Radius", bindsTo: { elementId: "el-1", paramKey: "radius" } },
    ];
    const result = resolveElementParams("el-1", baseParams, undefined, controls, { "ctrl-radius": 42 });
    expect(result).toEqual({ x: 10, y: 20, radius: 42 });

    // A control bound to a *different* element must not affect this one.
    const controlsElsewhere: SceneControl[] = [
      { id: "ctrl-radius", kind: "slider", label: "Radius", bindsTo: { elementId: "el-2", paramKey: "radius" } },
    ];
    const unaffected = resolveElementParams("el-1", baseParams, undefined, controlsElsewhere, {
      "ctrl-radius": 42,
    });
    expect(unaffected).toEqual(baseParams);
  });

  it("a live control value overrides the current step's override for the same param (controls win)", () => {
    const step: SceneStep = { overrides: { "el-1": { radius: 99 } } };
    const controls: SceneControl[] = [
      { id: "ctrl-radius", kind: "slider", label: "Radius", bindsTo: { elementId: "el-1", paramKey: "radius" } },
    ];
    const result = resolveElementParams("el-1", baseParams, step, controls, { "ctrl-radius": 7 });
    expect(result.radius).toBe(7);
  });
});

function multiTemplateConfig(): ComposedSceneConfig {
  return {
    canvas: { widthPx: 320, heightPx: 200 },
    elements: [
      { id: "circle", templateId: "shape-circle", params: { x: 40, y: 40, radius: 15, color: "blue" } },
      { id: "curve", templateId: "curve-linear", params: {} },
      { id: "marker", templateId: "slider-marker", params: { x: 60, y: 60, radius: 8 } },
    ],
    controls: [
      {
        id: "ctrl-marker-x",
        kind: "slider",
        label: "Marker position",
        bindsTo: { elementId: "marker", paramKey: "x" },
        min: 0,
        max: 200,
        step: 1,
      },
    ],
    steps: [
      { note: "Step one", overrides: {} },
      { note: "Step two", overrides: { marker: { x: 90 } } },
    ],
  };
}

describe("ComposedScene — static render (SCENE-005)", () => {
  it("renders a config with 2+ different templates without throwing, including its canvas, controls, and playback UI", () => {
    const html = renderToStaticMarkup(<ComposedScene config={multiTemplateConfig()} />);

    expect(html).toContain('data-testid="composed-scene-canvas"');
    expect(html).toContain("Marker position"); // control label
    expect(html).toContain("Step one"); // first step's note, shown by default
  });

  it("renders a static scene (no steps) without any playback controls", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: {} }],
    };
    const html = renderToStaticMarkup(<ComposedScene config={config} />);
    expect(html).toContain('data-testid="composed-scene-canvas"');
    // No stepCounter label (mocked next-intl returns the key itself).
    expect(html).not.toContain("stepCounter");
  });

  it("renders a scene with no controls without any control fields", () => {
    const config: ComposedSceneConfig = {
      canvas: { widthPx: 320, heightPx: 200 },
      elements: [{ id: "el-1", templateId: "shape-circle", params: {} }],
      steps: [{ overrides: {} }],
    };
    const html = renderToStaticMarkup(<ComposedScene config={config} />);
    expect(html).not.toContain('type="checkbox"');
  });
});
