import { describe, expect, it, beforeAll } from "vitest";
import * as Blockly from "blockly/core";

import {
  buildToolbox,
  compileWorkspaceToProgram,
  registerProgramBlocks,
  setAvailableControlIds,
} from "./block-editor";
import { isProgrammableSceneConfig } from "@/components/viz/programmable-scene/types";
import { runProgram } from "@/components/viz/programmable-scene/interpreter";

// A real (headless — no DOM/SVG, no jsdom) Blockly Workspace works fine
// for building and connecting blocks programmatically; only rendering
// (WorkspaceSvg via Blockly.inject) needs an actual browser. That's the
// same "extract the DOM-free logic, test it directly" convention this
// repo's other component tests already use (see composed-scene/index.tsx's
// own resolveElementParams comment) — here it lets the compiler be
// exercised against *real* Blockly Block objects rather than a hand-rolled
// stand-in, which is a meaningfully stronger test of PROG-005's actual
// objective ("compiling Blockly's workspace to ProgramNode").
function newWorkspace(): Blockly.Workspace {
  return new Blockly.Workspace();
}

function connectValue(host: Blockly.Block, inputName: string, valueBlock: Blockly.Block): void {
  host.getInput(inputName)!.connection!.connect(valueBlock.outputConnection!);
}

function connectStatementInput(host: Blockly.Block, inputName: string, first: Blockly.Block): void {
  host.getInput(inputName)!.connection!.connect(first.previousConnection!);
}

function chain(...blocks: Blockly.Block[]): Blockly.Block {
  for (let i = 0; i + 1 < blocks.length; i++) {
    const current = blocks[i]!;
    const next = blocks[i + 1]!;
    current.nextConnection!.connect(next.previousConnection!);
  }
  return blocks[0]!;
}

beforeAll(() => {
  registerProgramBlocks();
});

describe("buildToolbox (PROG-005 constraint — restricted to PROG-A3's block set only)", () => {
  function allBlockTypes(): string[] {
    const toolbox = buildToolbox() as { contents: { contents: { type: string }[] }[] };
    return toolbox.contents.flatMap((category) => category.contents.map((entry) => entry.type));
  }

  it("exposes exactly the curated 15-block instruction set, no more, no fewer", () => {
    const expected = [
      "program_literal_number",
      "program_literal_boolean",
      "program_literal_string",
      "program_literal_color",
      "program_variable_get",
      "program_variable_set",
      "program_input_time",
      "program_input_control",
      "program_arithmetic",
      "program_comparison",
      "program_logic_binary",
      "program_logic_not",
      "program_if",
      "program_repeat",
      "program_emit_element",
    ];
    const actual = allBlockTypes();
    expect(actual.sort()).toEqual([...expected].sort());
  });

  it("does not expose any of Blockly's own default text/list/procedure/variable blocks", () => {
    const actual = new Set(allBlockTypes());
    for (const stockType of ["text", "lists_create_with", "procedures_defnoreturn", "variables_get", "controls_if", "controls_repeat_ext"]) {
      expect(actual.has(stockType)).toBe(false);
    }
  });
});

describe("compileWorkspaceToProgram — PROG-005's acceptance criterion", () => {
  it("an empty workspace compiles to an empty sequence, accepted by PROG-001's validator", () => {
    const ws = newWorkspace();
    const program = compileWorkspaceToProgram(ws);
    expect(program).toEqual({ kind: "sequence", body: [] });
    expect(isProgrammableSceneConfig({ canvas: { widthPx: 100, heightPx: 100 }, program })).toBe(true);
  });

  it("a single emitElement block compiles to the matching AST and round-trips through the real interpreter", () => {
    const ws = newWorkspace();
    const emit = ws.newBlock("program_emit_element");
    emit.setFieldValue("shape-circle", "TEMPLATE");
    (emit as unknown as { updateShape_: (id: string) => void }).updateShape_("shape-circle");

    const x = ws.newBlock("program_literal_number");
    x.setFieldValue(10, "VALUE");
    connectValue(emit, "PARAM_x", x);
    const y = ws.newBlock("program_literal_number");
    y.setFieldValue(20, "VALUE");
    connectValue(emit, "PARAM_y", y);
    const radius = ws.newBlock("program_literal_number");
    radius.setFieldValue(5, "VALUE");
    connectValue(emit, "PARAM_radius", radius);
    const color = ws.newBlock("program_literal_color");
    color.setFieldValue("pink", "VALUE");
    connectValue(emit, "PARAM_color", color);

    const program = compileWorkspaceToProgram(ws);
    expect(program).toEqual({
      kind: "sequence",
      body: [
        {
          kind: "emitElement",
          templateId: "shape-circle",
          params: {
            x: { kind: "literal", value: 10 },
            y: { kind: "literal", value: 20 },
            radius: { kind: "literal", value: 5 },
            color: { kind: "literal", value: "pink" },
          },
        },
      ],
    });

    const config = { canvas: { widthPx: 100, heightPx: 100 }, program };
    expect(isProgrammableSceneConfig(config)).toBe(true);
    const result = runProgram(program, { t: 0, controls: {} });
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.templateId).toBe("shape-circle");
  });

  it("program_emit_element's param sockets change when the TEMPLATE dropdown changes (updateShape_)", () => {
    const ws = newWorkspace();
    const emit = ws.newBlock("program_emit_element") as unknown as {
      updateShape_: (id: string) => void;
      getInput: (name: string) => unknown;
    };
    emit.updateShape_("shape-circle");
    expect(emit.getInput("PARAM_radius")).toBeTruthy();
    expect(emit.getInput("PARAM_width")).toBeFalsy();

    emit.updateShape_("shape-rect");
    expect(emit.getInput("PARAM_radius")).toBeFalsy(); // removed — no longer relevant
    expect(emit.getInput("PARAM_width")).toBeTruthy(); // added
  });

  it("variableSet earlier in a chain feeds a variableGet later in the same chain, exactly as authored", () => {
    const ws = newWorkspace();
    const setBlock = ws.newBlock("program_variable_set");
    setBlock.setFieldValue("x", "NAME");
    const seven = ws.newBlock("program_literal_number");
    seven.setFieldValue(7, "VALUE");
    connectValue(setBlock, "VALUE", seven);

    const emit = ws.newBlock("program_emit_element");
    (emit as unknown as { updateShape_: (id: string) => void }).updateShape_("shape-circle");
    const getX = ws.newBlock("program_variable_get");
    getX.setFieldValue("x", "NAME");
    connectValue(emit, "PARAM_x", getX);

    chain(setBlock, emit);

    const program = compileWorkspaceToProgram(ws);
    expect(program.kind).toBe("sequence");
    expect(isProgrammableSceneConfig({ canvas: { widthPx: 10, heightPx: 10 }, program })).toBe(true);
    const result = runProgram(program, { t: 0, controls: {} });
    expect(result.elements[0]?.params.x).toBe(7);
  });

  it("if/else compiles both branches into then/else arrays", () => {
    const ws = newWorkspace();
    const ifBlock = ws.newBlock("program_if");
    const cond = ws.newBlock("program_literal_boolean");
    cond.setFieldValue("TRUE", "VALUE");
    connectValue(ifBlock, "CONDITION", cond);

    const thenEmit = ws.newBlock("program_emit_element");
    (thenEmit as unknown as { updateShape_: (id: string) => void }).updateShape_("shape-circle");
    connectStatementInput(ifBlock, "THEN", thenEmit);

    const elseEmit = ws.newBlock("program_emit_element");
    elseEmit.setFieldValue("shape-rect", "TEMPLATE");
    (elseEmit as unknown as { updateShape_: (id: string) => void }).updateShape_("shape-rect");
    connectStatementInput(ifBlock, "ELSE", elseEmit);

    const program = compileWorkspaceToProgram(ws);
    const zero = { kind: "literal", value: 0 };
    expect(program).toEqual({
      kind: "sequence",
      body: [
        {
          kind: "if",
          condition: { kind: "literal", value: true },
          then: [{ kind: "emitElement", templateId: "shape-circle", params: { x: zero, y: zero, radius: zero, color: zero } }],
          else: [{ kind: "emitElement", templateId: "shape-rect", params: { x: zero, y: zero, width: zero, height: zero, color: zero } }],
        },
      ],
    });
  });

  it("repeat compiles its count and body", () => {
    const ws = newWorkspace();
    const repeatBlock = ws.newBlock("program_repeat");
    const count = ws.newBlock("program_literal_number");
    count.setFieldValue(3, "VALUE");
    connectValue(repeatBlock, "COUNT", count);
    const emit = ws.newBlock("program_emit_element");
    (emit as unknown as { updateShape_: (id: string) => void }).updateShape_("shape-circle");
    connectStatementInput(repeatBlock, "BODY", emit);

    const program = compileWorkspaceToProgram(ws);
    const zero = { kind: "literal", value: 0 };
    expect(program).toEqual({
      kind: "sequence",
      body: [
        {
          kind: "repeat",
          count: { kind: "literal", value: 3 },
          body: [{ kind: "emitElement", templateId: "shape-circle", params: { x: zero, y: zero, radius: zero, color: zero } }],
        },
      ],
    });
    const result = runProgram(program, { t: 0, controls: {} });
    expect(result.elements).toHaveLength(3);
  });

  it("arithmetic/comparison/logic blocks nest and compile to the matching op nodes", () => {
    const ws = newWorkspace();
    const arithmetic = ws.newBlock("program_arithmetic");
    arithmetic.setFieldValue("+", "OP");
    const two = ws.newBlock("program_literal_number");
    two.setFieldValue(2, "VALUE");
    const three = ws.newBlock("program_literal_number");
    three.setFieldValue(3, "VALUE");
    connectValue(arithmetic, "LEFT", two);
    connectValue(arithmetic, "RIGHT", three);

    const comparison = ws.newBlock("program_comparison");
    comparison.setFieldValue(">", "OP");
    connectValue(comparison, "LEFT", arithmetic);
    const four = ws.newBlock("program_literal_number");
    four.setFieldValue(4, "VALUE");
    connectValue(comparison, "RIGHT", four);

    const notBlock = ws.newBlock("program_logic_not");
    connectValue(notBlock, "VALUE", comparison);

    const setBlock = ws.newBlock("program_variable_set");
    setBlock.setFieldValue("flag", "NAME");
    connectValue(setBlock, "VALUE", notBlock);

    const program = compileWorkspaceToProgram(ws);
    expect(program).toEqual({
      kind: "sequence",
      body: [
        {
          kind: "variableSet",
          name: "flag",
          value: {
            kind: "boolean",
            op: "not",
            args: [
              {
                kind: "comparison",
                op: ">",
                left: { kind: "arithmetic", op: "+", left: { kind: "literal", value: 2 }, right: { kind: "literal", value: 3 } },
                right: { kind: "literal", value: 4 },
              },
            ],
          },
        },
      ],
    });
  });

  it("multiple disconnected top-level stacks all run, concatenated in workspace order", () => {
    const ws = newWorkspace();
    const first = ws.newBlock("program_emit_element");
    (first as unknown as { updateShape_: (id: string) => void }).updateShape_("shape-circle");
    const second = ws.newBlock("program_emit_element");
    (second as unknown as { updateShape_: (id: string) => void }).updateShape_("shape-rect");
    // Deliberately NOT connected to each other — two separate top-level stacks.
    const program = compileWorkspaceToProgram(ws);
    expect(program.kind).toBe("sequence");
    expect((program as { body: unknown[] }).body).toHaveLength(2);
    const result = runProgram(program, { t: 0, controls: {} });
    expect(result.elements).toHaveLength(2);
  });

  it("reads a declared control's value via program_input_control, using setAvailableControlIds", () => {
    setAvailableControlIds(["speed"]);
    const ws = newWorkspace();
    const emit = ws.newBlock("program_emit_element");
    (emit as unknown as { updateShape_: (id: string) => void }).updateShape_("shape-circle");
    const controlInput = ws.newBlock("program_input_control");
    controlInput.setFieldValue("speed", "ID");
    connectValue(emit, "PARAM_x", controlInput);

    const program = compileWorkspaceToProgram(ws);
    expect(isProgrammableSceneConfig({
      canvas: { widthPx: 10, heightPx: 10 },
      program,
      controls: [{ id: "speed", kind: "slider", label: "Speed" }],
    })).toBe(true);
    const result = runProgram(program, { t: 0, controls: { speed: 42 } });
    expect(result.elements[0]?.params.x).toBe(42);
    setAvailableControlIds([]); // reset for other tests
  });

  it("an unfilled value socket compiles to a harmless literal 0 default, not a crash", () => {
    const ws = newWorkspace();
    const setBlock = ws.newBlock("program_variable_set");
    setBlock.setFieldValue("x", "NAME");
    // VALUE socket deliberately left empty.
    const program = compileWorkspaceToProgram(ws);
    expect(program).toEqual({
      kind: "sequence",
      body: [{ kind: "variableSet", name: "x", value: { kind: "literal", value: 0 } }],
    });
  });
});
