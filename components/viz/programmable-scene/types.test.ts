import { describe, expect, it } from "vitest";

import { isProgrammableSceneConfig } from "./types";
import type { ProgramNode, ProgrammableSceneConfig } from "./types";

function baseConfig(program: ProgramNode, extra: Partial<ProgrammableSceneConfig> = {}): unknown {
  return {
    canvas: { widthPx: 400, heightPx: 300 },
    program,
    ...extra,
  };
}

describe("isProgrammableSceneConfig — accepts valid configs", () => {
  it("accepts an empty sequence (a legitimate, non-error program per spec §6)", () => {
    expect(isProgrammableSceneConfig(baseConfig({ kind: "sequence", body: [] }))).toBe(true);
  });

  it("accepts a straightforward emitElement with a real templateId", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [{ kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "literal", value: 1 } } }],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(true);
  });

  it("accepts a variableGet reachable via a prior variableSet in the same sequence", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [
        { kind: "variableSet", name: "x", value: { kind: "literal", value: 1 } },
        { kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "variableGet", name: "x" } } },
      ],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(true);
  });

  it("accepts a variableGet reachable because BOTH if/else branches assign it before the read", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [
        {
          kind: "if",
          condition: { kind: "literal", value: true },
          then: [{ kind: "variableSet", name: "x", value: { kind: "literal", value: 1 } }],
          else: [{ kind: "variableSet", name: "x", value: { kind: "literal", value: 2 } }],
        },
        { kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "variableGet", name: "x" } } },
      ],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(true);
  });

  it("accepts a variableGet inside a repeat body set earlier in the same body", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [
        {
          kind: "repeat",
          count: { kind: "literal", value: 3 },
          body: [
            { kind: "variableSet", name: "x", value: { kind: "literal", value: 1 } },
            { kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "variableGet", name: "x" } } },
          ],
        },
      ],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(true);
  });

  it("accepts a declared control referenced via input control:<id>", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [{ kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "input", name: "control:speed" } } }],
    };
    expect(
      isProgrammableSceneConfig(
        baseConfig(program, { controls: [{ id: "speed", kind: "slider", label: "Speed" }] }),
      ),
    ).toBe(true);
  });

  it("accepts reading input t unconditionally", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [{ kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "input", name: "t" } } }],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(true);
  });
});

describe("isProgrammableSceneConfig — rejects malformed programs (spec §8)", () => {
  it("rejects a dangling variableGet with no prior variableSet", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [{ kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "variableGet", name: "never-set" } } }],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(false);
  });

  it("rejects a variableGet that is only assigned in ONE of an if's two branches", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [
        {
          kind: "if",
          condition: { kind: "literal", value: true },
          then: [{ kind: "variableSet", name: "x", value: { kind: "literal", value: 1 } }],
          else: [],
        },
        { kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "variableGet", name: "x" } } },
      ],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(false);
  });

  it("rejects a variableGet relying on a repeat body's assignment being visible after the loop", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [
        {
          kind: "repeat",
          count: { kind: "literal", value: 3 },
          body: [{ kind: "variableSet", name: "x", value: { kind: "literal", value: 1 } }],
        },
        { kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "variableGet", name: "x" } } },
      ],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(false);
  });

  it("rejects an emitElement referencing an unknown templateId", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [{ kind: "emitElement", templateId: "not-a-real-template", params: {} }],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(false);
  });

  it("rejects a node with an unknown kind", () => {
    const program = {
      kind: "sequence",
      body: [{ kind: "totally-made-up-kind", foo: "bar" }],
    } as unknown as ProgramNode;
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(false);
  });

  it("rejects an input referencing an undeclared control id", () => {
    const program: ProgramNode = {
      kind: "sequence",
      body: [{ kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "input", name: "control:speed" } } }],
    };
    expect(isProgrammableSceneConfig(baseConfig(program))).toBe(false); // no controls declared at all
  });

  it("rejects a non-object config", () => {
    expect(isProgrammableSceneConfig(null)).toBe(false);
    expect(isProgrammableSceneConfig("not a config")).toBe(false);
    expect(isProgrammableSceneConfig(42)).toBe(false);
  });

  it("rejects a config missing canvas dimensions", () => {
    expect(isProgrammableSceneConfig({ program: { kind: "sequence", body: [] } })).toBe(false);
  });
});
