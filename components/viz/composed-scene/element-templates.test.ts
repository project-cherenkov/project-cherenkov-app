import { describe, expect, it } from "vitest";
import { ELEMENT_TEMPLATES, ELEMENT_TEMPLATE_KEYS } from "./element-templates";
import type { ResolvedParams, ScaleFns } from "./element-templates";

// No real <canvas> in this vitest environment (jsdom does not implement
// CanvasRenderingContext2D), so — per the spec's own testing note
// ("a snapshot of the drawing calls, per the team's existing testing
// conventions") — templates are exercised against a minimal call-recording
// mock rather than pixel output.
function createMockCtx() {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "calls") return calls;
        if (typeof prop !== "string") return undefined;
        // Method call — record it and return a chainable no-op.
        return (...args: unknown[]) => {
          calls.push(`${prop}(${args.map(String).join(",")})`);
        };
      },
      set(_target, prop: string, value) {
        calls.push(`set ${prop}=${String(value)}`);
        return true;
      },
    },
  );
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
}

const identityScale: ScaleFns = {
  x: (v) => v,
  y: (v) => v,
  length: (v) => v,
};

// noUncheckedIndexedAccess (tsconfig.json) makes ELEMENT_TEMPLATES[key]
// read as `ElementTemplate | undefined`. Every call site below indexes
// with a key already known-good (drawn from ELEMENT_TEMPLATE_KEYS itself,
// or a literal registry id used elsewhere in this same file) — this helper
// asserts that and fails the test loudly if it's ever wrong, rather than
// scattering non-null assertions through the file.
function getTemplate(id: string) {
  const template = ELEMENT_TEMPLATES[id];
  if (!template) throw new Error(`No such template: ${id}`);
  return template;
}

function defaultParams(templateId: string): ResolvedParams {
  const template = getTemplate(templateId);
  const params: ResolvedParams = {};
  for (const spec of template.paramSchema) {
    params[spec.key] = spec.default;
  }
  return params;
}

describe("ELEMENT_TEMPLATES registry", () => {
  it("has at least the v1 template set described in the spec (A-2)", () => {
    expect(ELEMENT_TEMPLATE_KEYS).toEqual(
      expect.arrayContaining([
        "shape-circle",
        "shape-rect",
        "shape-line",
        "shape-arrow",
        "text-label",
        "curve-linear",
        "curve-quadratic",
        "curve-sine",
        "curve-points",
        "slider-marker",
        "array-pointers",
      ]),
    );
  });

  it.each(ELEMENT_TEMPLATE_KEYS)("%s has a consistent paramSchema", (key) => {
    const template = getTemplate(key);
    expect(template.id).toBe(key);
    expect(template.label.length).toBeGreaterThan(0);

    const seenKeys = new Set<string>();
    for (const spec of template.paramSchema) {
      expect(seenKeys.has(spec.key)).toBe(false); // no duplicate param keys
      seenKeys.add(spec.key);

      if (spec.type === "number") {
        expect(typeof spec.default).toBe("number");
        if (spec.min !== undefined && spec.max !== undefined) {
          expect(spec.min).toBeLessThanOrEqual(spec.max);
          expect(spec.default as number).toBeGreaterThanOrEqual(spec.min);
          expect(spec.default as number).toBeLessThanOrEqual(spec.max);
        }
      } else if (spec.type === "boolean") {
        expect(typeof spec.default).toBe("boolean");
      } else if (spec.type === "select") {
        expect(spec.options?.length).toBeGreaterThan(0);
        expect(spec.options).toContain(spec.default);
      } else if (spec.type === "text") {
        expect(typeof spec.default).toBe("string");
        if (spec.maxLength !== undefined) {
          expect((spec.default as string).length).toBeLessThanOrEqual(spec.maxLength);
        }
      }
    }
  });

  it.each(ELEMENT_TEMPLATE_KEYS)("%s renders without throwing using its own defaults", (key) => {
    const template = getTemplate(key);
    const ctx = createMockCtx();
    expect(() => template.render(ctx, defaultParams(key), identityScale)).not.toThrow();
    // Every template should actually draw something.
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it("shape-circle draws a filled arc at the given position/radius", () => {
    const ctx = createMockCtx();
    getTemplate("shape-circle").render(
      ctx,
      { x: 10, y: 20, radius: 5, color: "blue" },
      identityScale,
    );
    expect(ctx.calls).toContain("arc(10,20,5,0,6.283185307179586)");
    expect(ctx.calls).toContain("fill()");
  });

  it("array-pointers respects activeCount and only draws that many cells", () => {
    const ctx = createMockCtx();
    getTemplate("array-pointers").render(
      ctx,
      { ...defaultParams("array-pointers"), activeCount: "3" },
      identityScale,
    );
    const fillTextCalls = ctx.calls.filter((c) => c.startsWith("fillText("));
    // 3 cell-value labels; no pointer label by default (pointer1Index=0 has
    // label "i" though, so at least 3 value labels + up to 1 pointer label).
    expect(fillTextCalls.length).toBeGreaterThanOrEqual(3);
    expect(fillTextCalls.length).toBeLessThanOrEqual(4);
  });

  it("curve-points respects pointCount and only plots that many points", () => {
    const ctx = createMockCtx();
    getTemplate("curve-points").render(
      ctx,
      { ...defaultParams("curve-points"), pointCount: "2" },
      identityScale,
    );
    const moveToCalls = ctx.calls.filter((c) => c.startsWith("moveTo("));
    const lineToCalls = ctx.calls.filter((c) => c.startsWith("lineTo("));
    expect(moveToCalls.length).toBe(1);
    expect(lineToCalls.length).toBe(1); // 2 points => 1 segment
  });

  it("curve-sine samples across the declared domain", () => {
    const ctx = createMockCtx();
    getTemplate("curve-sine").render(ctx, defaultParams("curve-sine"), identityScale);
    const lineToCalls = ctx.calls.filter((c) => c.startsWith("lineTo("));
    expect(lineToCalls.length).toBe(60); // 60 samples => 1 moveTo + 60 lineTo
  });
});
