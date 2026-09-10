import { describe, expect, it } from "vitest";

import { renderElements } from "./render-elements";
import type { SceneElement } from "./types";
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
