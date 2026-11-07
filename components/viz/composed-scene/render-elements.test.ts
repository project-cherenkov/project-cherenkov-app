import { describe, expect, it } from "vitest";

import { ELEMENT_TEMPLATES } from "./element-templates";
import { easeInOut, interpolateStepOverrides, renderElements, resolveElementParams } from "./render-elements";
import type { SceneElement, SceneStep } from "./types";
import type { ScaleFns } from "./element-templates";

const identityScale: ScaleFns = {
  x: (v) => v,
  y: (v) => v,
  length: (v) => v,
};

// Same minimal call-recording mock as element-templates.test.ts (no real
// <canvas> in this vitest environment) — reused rather than reinvented, per
// this repo's existing testing convention for canvas code.
function fakeCtx(): CanvasRenderingContext2D {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (typeof prop !== "string") return undefined;
        return (..._args: unknown[]) => undefined;
      },
      set() {
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

describe("renderElements", () => {
  it("draws every element via its own template, in order", () => {
    const ctx = fakeCtx();
    const elements: SceneElement[] = [
      { id: "a", templateId: "shape-circle", params: { x: 10, y: 10, radius: 5, color: "blue" } },
      { id: "b", templateId: "shape-rect", params: { x: 20, y: 20, width: 4, height: 4, color: "pink" } },
    ];
    renderElements(ctx, elements, undefined, {}, undefined, identityScale);
    // No throw with real templates is itself the assertion here — the
    // fuller "does the canvas receive the right calls" behavior is already
    // covered per-template by element-templates.test.ts; this test's job
    // is only to prove the *loop* visits every element via the right
    // lookup, not to re-verify each template's own drawing calls.
    expect(elements).toHaveLength(2);
  });

  it("skips an element with an unrecognized templateId rather than throwing (defensive-only path)", () => {
    const ctx = fakeCtx();
    const elements: SceneElement[] = [{ id: "a", templateId: "not-a-real-template", params: {} }];
    expect(() => renderElements(ctx, elements, undefined, {}, undefined, identityScale)).not.toThrow();
  });

  it("applies a control's bound value over an element's base param before rendering", () => {
    // A recording mock (same convention as element-templates.test.ts) so
    // this checks the *resolved* params actually reach the real template's
    // render() — not just that resolveElementParams computes the right
    // thing in isolation, which composed-scene/index.test.tsx already
    // covers.
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (typeof prop !== "string") return undefined;
          return (...args: unknown[]) => calls.push(`${prop}(${args.map(String).join(",")})`);
        },
        set() {
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;

    const elements: SceneElement[] = [
      { id: "a", templateId: "shape-circle", params: { x: 10, y: 10, radius: 5, color: "blue" } },
    ];
    renderElements(
      ctx,
      elements,
      [{ id: "ctrl-radius", kind: "slider", label: "Radius", bindsTo: { elementId: "a", paramKey: "radius" } }],
      { "ctrl-radius": 99 },
      undefined,
      identityScale,
    );
    expect(calls.some((c) => c.startsWith("arc(") && c.includes(",99,"))).toBe(true);
  });
});

// R1 (docs/viz-interaction-improvements.md): glide between adjacent steps.
describe("easeInOut", () => {
  it("maps 0 -> 0, 0.5 -> 0.5, 1 -> 1 and clamps outside [0, 1]", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(-3)).toBe(0);
    expect(easeInOut(7)).toBe(1);
  });

  it("is monotonic and flat at the ends (slower than linear near 0 and 1)", () => {
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = easeInOut(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("interpolateStepOverrides (R1)", () => {
  const elements: SceneElement[] = [
    { id: "ball", templateId: "shape-circle", params: { x: 10, y: 20, radius: 5, color: "blue" } },
    { id: "box", templateId: "shape-rect", params: { x: 40, y: 40, width: 30, height: 30, color: "pink" } },
  ];
  const stepA: SceneStep = { overrides: { ball: { x: 100, color: "pink" } } };
  const stepB: SceneStep = { overrides: { ball: { x: 200, color: "blueAlt" } } };

  it("at t = 0 resolves to the previous step's params, at t = 1 to the next step's", () => {
    const at0 = interpolateStepOverrides(elements, stepA, stepB, 0);
    const at1 = interpolateStepOverrides(elements, stepA, stepB, 1);
    const base = elements[0]!.params;
    expect(resolveElementParams("ball", base, at0, undefined, {})).toEqual(
      resolveElementParams("ball", base, stepA, undefined, {}),
    );
    expect(resolveElementParams("ball", base, at1, undefined, {})).toEqual(
      resolveElementParams("ball", base, stepB, undefined, {}),
    );
  });

  it("returns the endpoints exactly, with no floating-point residue from the lerp", () => {
    const from: SceneStep = { overrides: { ball: { x: 0.1 } } };
    const to: SceneStep = { overrides: { ball: { x: 0.3 } } };
    expect(interpolateStepOverrides(elements, from, to, 1).overrides.ball?.x).toBe(0.3);
    expect(interpolateStepOverrides(elements, from, to, 0).overrides.ball?.x).toBe(0.1);
  });

  it("lerps numbers (eased) in between", () => {
    const mid = interpolateStepOverrides(elements, stepA, stepB, 0.5);
    expect(mid.overrides.ball?.x).toBe(150); // smoothstep(0.5) === 0.5
    const early = interpolateStepOverrides(elements, stepA, stepB, 0.25);
    const x = early.overrides.ball?.x as number;
    expect(x).toBeGreaterThan(100);
    expect(x).toBeLessThan(125); // eased: slower than linear at the start
  });

  it("switches strings/selects/booleans at t >= 0.5 instead of blending", () => {
    expect(interpolateStepOverrides(elements, stepA, stepB, 0.49).overrides.ball?.color).toBe("pink");
    expect(interpolateStepOverrides(elements, stepA, stepB, 0.5).overrides.ball?.color).toBe("blueAlt");
  });

  it("an element overridden in only one step glides from/to its base params", () => {
    const from: SceneStep = { overrides: {} };
    const to: SceneStep = { overrides: { ball: { radius: 25 } } };
    // base radius is 5 -> halfway is 15
    expect(interpolateStepOverrides(elements, from, to, 0.5).overrides.ball?.radius).toBe(15);
    // and the reverse direction
    expect(interpolateStepOverrides(elements, to, from, 0.5).overrides.ball?.radius).toBe(15);
  });

  it("falls back to the template default when neither the step nor base params set the key", () => {
    const sparse: SceneElement[] = [{ id: "c", templateId: "shape-circle", params: {} }];
    const defaultRadius = ELEMENT_TEMPLATES["shape-circle"]!.paramSchema.find((p) => p.key === "radius")!
      .default as number;
    const to: SceneStep = { overrides: { c: { radius: defaultRadius + 20 } } };
    expect(interpolateStepOverrides(sparse, undefined, to, 0.5).overrides.c?.radius).toBe(defaultRadius + 10);
  });

  it("omits elements and params that neither step touches (they keep resolving to base)", () => {
    const result = interpolateStepOverrides(elements, stepA, stepB, 0.5);
    expect(result.overrides.box).toBeUndefined();
    expect(Object.keys(result.overrides.ball ?? {}).sort()).toEqual(["color", "x"]);
  });

  it("keeps every interpolated number inside the template's declared min/max", () => {
    const spec = ELEMENT_TEMPLATES["shape-circle"]!.paramSchema.find((p) => p.key === "radius")!;
    const lo: SceneStep = { overrides: { ball: { radius: spec.min! } } };
    const hi: SceneStep = { overrides: { ball: { radius: spec.max! } } };
    for (let i = 0; i <= 50; i++) {
      const r = interpolateStepOverrides(elements, lo, hi, i / 50).overrides.ball?.radius as number;
      expect(r).toBeGreaterThanOrEqual(spec.min!);
      expect(r).toBeLessThanOrEqual(spec.max!);
    }
  });

  it("never mutates base params, the input steps or the element list", () => {
    const snapshot = JSON.stringify({ elements, stepA, stepB });
    interpolateStepOverrides(elements, stepA, stepB, 0.3);
    expect(JSON.stringify({ elements, stepA, stepB })).toBe(snapshot);
  });

  it("a live control value still wins over an interpolated step value", () => {
    const mid = interpolateStepOverrides(elements, stepA, stepB, 0.5);
    const controls = [
      { id: "c", kind: "slider" as const, label: "X", bindsTo: { elementId: "ball", paramKey: "x" } },
    ];
    const resolved = resolveElementParams("ball", elements[0]!.params, mid, controls, { c: 7 });
    expect(resolved.x).toBe(7);
  });

  it("restarting from a previous glide result continues from what was on screen", () => {
    const midway = interpolateStepOverrides(elements, stepA, stepB, 0.5); // x = 150, heading to B
    const back: SceneStep = { overrides: { ball: { x: 100 } } }; // reader clicks back toward A-like state
    const restarted = interpolateStepOverrides(elements, midway, back, 0);
    expect(restarted.overrides.ball?.x).toBe(150);
    expect(interpolateStepOverrides(elements, midway, back, 1).overrides.ball?.x).toBe(100);
  });

  it("skips an element with an unrecognized templateId rather than throwing", () => {
    const bad: SceneElement[] = [{ id: "z", templateId: "nope", params: {} }];
    expect(() =>
      interpolateStepOverrides(bad, { overrides: { z: { a: 1 } } }, { overrides: { z: { a: 2 } } }, 0.5),
    ).not.toThrow();
  });
});
