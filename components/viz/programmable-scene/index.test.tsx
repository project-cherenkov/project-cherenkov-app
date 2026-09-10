import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Same render-test convention as the rest of this repo's component tests
// (renderToStaticMarkup + string assertions, next-intl mocked to an
// identity translator) — see composed-scene/index.test.tsx for the same
// pattern applied to the other engine this component mirrors.
import { vi } from "vitest";
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { ProgrammableScene, TakingTooLongNotice, decideFrame } from "./index";
import type { ProgrammableSceneConfig, ProgramNode } from "./types";

function config(program: ProgramNode, extra: Partial<ProgrammableSceneConfig> = {}): ProgrammableSceneConfig {
  return {
    canvas: { widthPx: 320, heightPx: 200 },
    program,
    ...extra,
  };
}

describe("decideFrame (PROG-003 — the interpreter-calling per-tick decision)", () => {
  it("shouldDraw is true and showNotice is false for an ordinary program within budget", () => {
    const cfg = config({
      kind: "sequence",
      body: [{ kind: "emitElement", templateId: "shape-circle", params: {} }],
    });
    const decision = decideFrame(cfg, 0, {});
    expect(decision.shouldDraw).toBe(true);
    expect(decision.showNotice).toBe(false);
    expect(decision.elements).toHaveLength(1);
  });

  it("shouldDraw is false and showNotice is true the moment a tick exceeds its budget — the exact 'keep last frame, show notice, never blank' contract from spec §5/§6: the component's draw effect only ever touches the canvas when shouldDraw is true, so a false value here is what leaves whatever was already on the canvas untouched, rather than clearing or overwriting it with a partial frame", () => {
    let chain: ProgramNode = { kind: "literal", value: 1 };
    for (let i = 0; i < 50; i++) {
      chain = { kind: "arithmetic", op: "+", left: chain, right: { kind: "literal", value: 1 } };
    }
    const cfg = config({ kind: "sequence", body: [{ kind: "variableSet", name: "x", value: chain }] });
    const decision = decideFrame(cfg, 0, {}, 10); // tiny budget, guaranteed to trip
    expect(decision.shouldDraw).toBe(false);
    expect(decision.showNotice).toBe(true);
  });

  it("passes elapsed time and control values through to the program", () => {
    const cfg = config({
      kind: "sequence",
      body: [
        {
          kind: "emitElement",
          templateId: "shape-circle",
          params: { x: { kind: "input", name: "t" }, y: { kind: "input", name: "control:speed" } },
        },
      ],
    });
    const decision = decideFrame(cfg, 3.5, { speed: 7 });
    expect(decision.elements[0]?.params).toEqual({ x: 3.5, y: 7 });
  });
});

describe("TakingTooLongNotice", () => {
  it("renders nothing when show is false", () => {
    const html = renderToStaticMarkup(<TakingTooLongNotice show={false} />);
    expect(html).toBe("");
  });

  it("renders the notice when show is true", () => {
    const html = renderToStaticMarkup(<TakingTooLongNotice show={true} />);
    expect(html).toContain('data-testid="programmable-scene-budget-notice"');
    expect(html).toContain("programmableSceneBudgetNotice"); // mocked next-intl returns the key itself
  });
});

describe("ProgrammableScene — static render (PROG-003, mirroring composed-scene/index.test.tsx's structure)", () => {
  it("renders its canvas and control labels without throwing", () => {
    const cfg = config(
      { kind: "sequence", body: [{ kind: "emitElement", templateId: "shape-circle", params: {} }] },
      { controls: [{ id: "speed", kind: "slider", label: "Speed" }] },
    );
    const html = renderToStaticMarkup(<ProgrammableScene config={cfg} />);
    expect(html).toContain('data-testid="programmable-scene-canvas"');
    expect(html).toContain("Speed"); // control label
  });

  it("renders a program with no controls without any control fields", () => {
    const cfg = config({ kind: "sequence", body: [] });
    const html = renderToStaticMarkup(<ProgrammableScene config={cfg} />);
    expect(html).toContain('data-testid="programmable-scene-canvas"');
    expect(html).not.toContain('type="checkbox"');
  });

  it("does not render the budget notice on initial (SSR) render — it only appears once a tick actually exceeds budget", () => {
    const cfg = config({ kind: "sequence", body: [] });
    const html = renderToStaticMarkup(<ProgrammableScene config={cfg} />);
    expect(html).not.toContain('data-testid="programmable-scene-budget-notice"');
  });
});
