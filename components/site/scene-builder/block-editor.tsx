"use client";

import { useEffect, useRef } from "react";
import * as Blockly from "blockly/core";

import { COLOR_OPTIONS, ELEMENT_TEMPLATES } from "@/components/viz/composed-scene/element-templates";
import type { ProgramNode } from "@/components/viz/programmable-scene/types";

// ---------------------------------------------------------------------
// PROG-R2's whole point, stated once here as the file's own governing
// rule: this module never imports `blockly/javascript` (or any other
// Blockly code-generator language module), never calls `eval`, `new
// Function`, or the `Function` constructor. Blockly is used purely as a
// visual block-editing UI and a serialization format for a workspace's
// block tree — `compileWorkspaceToProgram` below walks that tree by hand
// (getFieldValue / getInputTargetBlock / getNextBlock), the same shape of
// walk interpreter.ts's own runProgram does over the AST it produces. See
// this feature's implementation report for how this is checked in CI
// (PROG-006).
// ---------------------------------------------------------------------

// Every value-producing block shares this output check, and every value
// input socket requires it — so any expression block plugs into any
// param/condition/count socket (this instruction set has no further type
// distinctions to enforce; see interpreter.ts's own toNumber/toBoolean
// coercions, which is where "the wrong kind of expression in this socket"
// actually gets resolved, not at authoring time).
const VALUE_CHECK = "ProgramValue";

const EMIT_ELEMENT_PARAM_PREFIX = "PARAM_";
function paramInputName(key: string): string {
  return `${EMIT_ELEMENT_PARAM_PREFIX}${key}`;
}

// Read by program_input_control's dynamic dropdown generator at flyout/
// field-open time — Blockly's own supported pattern for a field whose
// options depend on external, changing state (here, the scene's currently
// declared controls) rather than being fixed at block-definition time.
// setAvailableControlIds is called by BlockEditor's own effect below
// whenever its `controls` prop changes.
let availableControlIds: string[] = [];
export function setAvailableControlIds(ids: string[]): void {
  availableControlIds = ids;
}
function controlDropdownOptions(): [string, string][] {
  return availableControlIds.length > 0
    ? availableControlIds.map((id) => [id, id])
    : [["(no controls declared)", ""]]; // Blockly requires >=1 option; an empty program_input_control is caught by isProgrammableSceneConfig at save time either way.
}

function elementTemplateDropdownOptions(): [string, string][] {
  const entries = Object.entries(ELEMENT_TEMPLATES).map(([id, template]): [string, string] => [
    template.label,
    id,
  ]);
  // Same defensive floor as controlDropdownOptions — ELEMENT_TEMPLATES is
  // never actually empty in practice, but a dropdown with zero options is
  // a Blockly-level error, not a graceful empty state.
  return entries.length > 0 ? entries : [["(no templates registered)", ""]];
}

// One JSON block definition per PROG-A3 concept that has a genuinely fixed
// shape (arity, field count) regardless of authoring state —
// program_emit_element is the one exception, registered separately below
// because its shape (which param sockets it has) depends on which
// template is selected.
//
// 15 block types total for this instruction set's 11 ProgramNode kinds:
// `literal` becomes 4 (PROG-A3's own phrasing already enumerates
// "number/boolean/string/color" as separate literal varieties), `input`
// becomes 2 (t vs a declared control — structurally different fields),
// `boolean` becomes 2 (and/or share an arity and an op dropdown; `not` is
// unary, a different shape), everything else is 1:1. `sequence` gets no
// block at all — see compileWorkspaceToProgram's own comment for why a
// stack of statement blocks needs no dedicated wrapper block.
function jsonBlockDefinitions() {
  return [
    // --- literals ---
    {
      type: "program_literal_number",
      message0: "%1",
      args0: [{ type: "field_number", name: "VALUE", value: 0 }],
      output: VALUE_CHECK,
      colour: 160,
      tooltip: "A fixed number.",
    },
    {
      type: "program_literal_boolean",
      message0: "%1",
      args0: [
        {
          type: "field_dropdown",
          name: "VALUE",
          options: [
            ["true", "TRUE"],
            ["false", "FALSE"],
          ],
        },
      ],
      output: VALUE_CHECK,
      colour: 160,
      tooltip: "A fixed true/false value.",
    },
    {
      type: "program_literal_string",
      message0: "%1",
      args0: [{ type: "field_input", name: "VALUE", text: "" }],
      output: VALUE_CHECK,
      colour: 160,
      tooltip: "A fixed piece of text.",
    },
    {
      type: "program_literal_color",
      message0: "%1",
      args0: [
        {
          type: "field_dropdown",
          name: "VALUE",
          options: COLOR_OPTIONS.map((c): [string, string] => [c, c]),
        },
      ],
      output: VALUE_CHECK,
      colour: 160,
      tooltip: "A fixed color, from this scene's palette.",
    },

    // --- variables (flat scope, no closures — PROG-A3) ---
    {
      type: "program_variable_get",
      message0: "get %1",
      args0: [{ type: "field_input", name: "NAME", text: "x" }],
      output: VALUE_CHECK,
      colour: 225,
      tooltip: "Read a variable's current value. Must be set earlier in the program.",
    },
    {
      type: "program_variable_set",
      message0: "set %1 to %2",
      args0: [
        { type: "field_input", name: "NAME", text: "x" },
        { type: "input_value", name: "VALUE", check: VALUE_CHECK },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 225,
      tooltip: "Assign a value to a variable, creating it if this is the first time.",
    },

    // --- program inputs ---
    {
      type: "program_input_time",
      message0: "elapsed time (t)",
      output: VALUE_CHECK,
      colour: 65,
      tooltip: "Seconds since this scene started.",
    },
    {
      type: "program_input_control",
      message0: "control %1",
      args0: [{ type: "field_dropdown", name: "ID", options: controlDropdownOptions }],
      output: VALUE_CHECK,
      colour: 65,
      tooltip: "A reader-facing control's current live value.",
    },

    // --- arithmetic / comparison / logic ---
    {
      type: "program_arithmetic",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "LEFT", check: VALUE_CHECK },
        {
          type: "field_dropdown",
          name: "OP",
          options: [
            ["+", "+"],
            ["\u2212", "-"],
            ["\u00d7", "*"],
            ["\u00f7", "/"],
          ],
        },
        { type: "input_value", name: "RIGHT", check: VALUE_CHECK },
      ],
      inputsInline: true,
      output: VALUE_CHECK,
      colour: 230,
      tooltip: "Arithmetic. Dividing by zero gives 0, never an error.",
    },
    {
      type: "program_comparison",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "LEFT", check: VALUE_CHECK },
        {
          type: "field_dropdown",
          name: "OP",
          options: [
            ["<", "<"],
            ["\u2264", "<="],
            ["=", "="],
            ["\u2265", ">="],
            [">", ">"],
          ],
        },
        { type: "input_value", name: "RIGHT", check: VALUE_CHECK },
      ],
      inputsInline: true,
      output: VALUE_CHECK,
      colour: 210,
      tooltip: "Compare two values.",
    },
    {
      type: "program_logic_binary",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "LEFT", check: VALUE_CHECK },
        {
          type: "field_dropdown",
          name: "OP",
          options: [
            ["and", "and"],
            ["or", "or"],
          ],
        },
        { type: "input_value", name: "RIGHT", check: VALUE_CHECK },
      ],
      inputsInline: true,
      output: VALUE_CHECK,
      colour: 120,
      tooltip: "Combine two true/false values.",
    },
    {
      type: "program_logic_not",
      message0: "not %1",
      args0: [{ type: "input_value", name: "VALUE", check: VALUE_CHECK }],
      inputsInline: true,
      output: VALUE_CHECK,
      colour: 120,
      tooltip: "Flip a true/false value.",
    },

    // --- control flow ---
    {
      type: "program_if",
      message0: "if %1",
      args0: [{ type: "input_value", name: "CONDITION", check: VALUE_CHECK }],
      message1: "then %1",
      args1: [{ type: "input_statement", name: "THEN" }],
      message2: "else %1",
      args2: [{ type: "input_statement", name: "ELSE" }],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: "Branch on a true/false condition. Both branches are optional (may be empty).",
    },
    {
      type: "program_repeat",
      message0: "repeat %1 times",
      args0: [{ type: "input_value", name: "COUNT", check: VALUE_CHECK }],
      message1: "do %1",
      args1: [{ type: "input_statement", name: "BODY" }],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: "Repeat the enclosed blocks. The count is capped at a fixed maximum, checked once before the loop starts.",
    },
  ];
}

// program_emit_element is registered by hand (not JSON) because its shape
// — which param value-inputs it has — depends on which element template
// is currently selected, rebuilt via updateShape_ whenever the TEMPLATE
// dropdown changes. saveExtraState/loadExtraState (Blockly's supported
// JSON-serialization hooks for exactly this kind of mutating block) keep
// the selected templateId — and therefore the right param sockets —
// correct across a save/reload of the workspace, not just the current
// session.
// Mutator-block-specific shape: adds `updateShape_` (Blockly's own naming
// convention for this exact "rebuild inputs based on a field value"
// pattern, e.g. its own controls_if) on top of the standard Block/
// saveExtraState/loadExtraState hooks.
interface EmitElementBlock extends Blockly.Block {
  updateShape_(templateId: string): void;
}

function registerEmitElementBlock(): void {
  Blockly.Blocks["program_emit_element"] = {
    init(this: EmitElementBlock) {
      this.appendDummyInput("TEMPLATE_ROW")
        .appendField("draw")
        .appendField(new Blockly.FieldDropdown(elementTemplateDropdownOptions), "TEMPLATE");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(0);
      this.setTooltip("Draws one element using this scene's shared element templates.");
      const field = this.getField("TEMPLATE") as Blockly.FieldDropdown;
      field.setValidator((newValue: string) => {
        this.updateShape_(newValue);
        return newValue;
      });
      this.updateShape_(this.getFieldValue("TEMPLATE"));
    },

    updateShape_(this: EmitElementBlock, templateId: string) {
      const template = ELEMENT_TEMPLATES[templateId];
      const desiredKeys = new Set((template?.paramSchema ?? []).map((p) => p.key));

      for (const input of [...this.inputList]) {
        const name = input.name;
        if (name.startsWith(EMIT_ELEMENT_PARAM_PREFIX) && !desiredKeys.has(name.slice(EMIT_ELEMENT_PARAM_PREFIX.length))) {
          this.removeInput(name);
        }
      }

      const existing = new Set(this.inputList.map((i) => i.name));
      for (const p of template?.paramSchema ?? []) {
        const name = paramInputName(p.key);
        if (!existing.has(name)) {
          this.appendValueInput(name).setCheck(VALUE_CHECK).appendField(p.label);
        }
      }
    },

    saveExtraState(this: EmitElementBlock) {
      return { templateId: this.getFieldValue("TEMPLATE") };
    },

    loadExtraState(this: EmitElementBlock, state: { templateId?: string }) {
      if (state.templateId) {
        this.setFieldValue(state.templateId, "TEMPLATE");
        this.updateShape_(state.templateId);
      }
    },
  } as unknown as { init: (this: Blockly.Block) => void };
}

let blocksRegistered = false;

// Idempotent — safe to call from every BlockEditor mount (including
// React StrictMode's intentional double-invoke in dev). Re-registering the
// same block type isn't harmful in itself (Blockly just overwrites the
// definition), this flag only avoids redundant work and console noise.
export function registerProgramBlocks(): void {
  if (blocksRegistered) return;
  Blockly.common.defineBlocksWithJsonArray(jsonBlockDefinitions());
  registerEmitElementBlock();
  blocksRegistered = true;
}

// The restricted toolbox itself (PROG-005's constraint: "toolbox
// restricted to PROG-A3's block set only" — no access to Blockly's own
// default text/list/procedure/variable blocks, which this toolbox simply
// never lists). 6 categories, matching this instruction set's own natural
// grouping.
export function buildToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: "Values",
        colour: "160",
        contents: [
          { kind: "block", type: "program_literal_number" },
          { kind: "block", type: "program_literal_boolean" },
          { kind: "block", type: "program_literal_string" },
          { kind: "block", type: "program_literal_color" },
        ],
      },
      {
        kind: "category",
        name: "Variables",
        colour: "225",
        contents: [
          { kind: "block", type: "program_variable_get" },
          { kind: "block", type: "program_variable_set" },
        ],
      },
      {
        kind: "category",
        name: "Inputs",
        colour: "65",
        contents: [
          { kind: "block", type: "program_input_time" },
          { kind: "block", type: "program_input_control" },
        ],
      },
      {
        kind: "category",
        name: "Math & logic",
        colour: "210",
        contents: [
          { kind: "block", type: "program_arithmetic" },
          { kind: "block", type: "program_comparison" },
          { kind: "block", type: "program_logic_binary" },
          { kind: "block", type: "program_logic_not" },
        ],
      },
      {
        kind: "category",
        name: "Control",
        colour: "290",
        contents: [
          { kind: "block", type: "program_if" },
          { kind: "block", type: "program_repeat" },
        ],
      },
      {
        kind: "category",
        name: "Draw",
        colour: "0",
        contents: [{ kind: "block", type: "program_emit_element" }],
      },
    ],
  };
}

function compileValue(block: Blockly.Block | null): ProgramNode {
  // An empty socket (nothing plugged in) compiles to a harmless default —
  // isProgrammableSceneConfig doesn't reject this (there's no "empty
  // socket" concept once compiled to an AST; a literal 0 is just a
  // literal 0), and the interpreter would treat a genuinely missing value
  // no differently. Authoring feedback for "you left a socket empty"
  // belongs at the UI layer (Blockly's own warning indicators for
  // unfilled required inputs), not the compiler.
  if (!block) return { kind: "literal", value: 0 };

  switch (block.type) {
    case "program_literal_number":
      return { kind: "literal", value: Number(block.getFieldValue("VALUE")) };
    case "program_literal_boolean":
      return { kind: "literal", value: block.getFieldValue("VALUE") === "TRUE" };
    case "program_literal_string":
    case "program_literal_color":
      return { kind: "literal", value: String(block.getFieldValue("VALUE")) };
    case "program_variable_get":
      return { kind: "variableGet", name: String(block.getFieldValue("NAME")) };
    case "program_input_time":
      return { kind: "input", name: "t" };
    case "program_input_control":
      return { kind: "input", name: `control:${String(block.getFieldValue("ID"))}` };
    case "program_arithmetic":
      return {
        kind: "arithmetic",
        op: block.getFieldValue("OP"),
        left: compileValue(block.getInputTargetBlock("LEFT")),
        right: compileValue(block.getInputTargetBlock("RIGHT")),
      };
    case "program_comparison":
      return {
        kind: "comparison",
        op: block.getFieldValue("OP"),
        left: compileValue(block.getInputTargetBlock("LEFT")),
        right: compileValue(block.getInputTargetBlock("RIGHT")),
      };
    case "program_logic_binary":
      return {
        kind: "boolean",
        op: block.getFieldValue("OP"),
        args: [compileValue(block.getInputTargetBlock("LEFT")), compileValue(block.getInputTargetBlock("RIGHT"))],
      };
    case "program_logic_not":
      return { kind: "boolean", op: "not", args: [compileValue(block.getInputTargetBlock("VALUE"))] };
    default:
      // Unreachable given the restricted toolbox — every block a reader
      // can actually place is one of the cases above.
      return { kind: "literal", value: 0 };
  }
}

function compileStatementChain(block: Blockly.Block | null): ProgramNode[] {
  const body: ProgramNode[] = [];
  let current = block;
  while (current) {
    body.push(compileStatement(current));
    current = current.getNextBlock();
  }
  return body;
}

function compileStatement(block: Blockly.Block): ProgramNode {
  switch (block.type) {
    case "program_variable_set":
      return {
        kind: "variableSet",
        name: String(block.getFieldValue("NAME")),
        value: compileValue(block.getInputTargetBlock("VALUE")),
      };
    case "program_if":
      return {
        kind: "if",
        condition: compileValue(block.getInputTargetBlock("CONDITION")),
        then: compileStatementChain(block.getInputTargetBlock("THEN")),
        else: compileStatementChain(block.getInputTargetBlock("ELSE")),
      };
    case "program_repeat":
      return {
        kind: "repeat",
        count: compileValue(block.getInputTargetBlock("COUNT")),
        body: compileStatementChain(block.getInputTargetBlock("BODY")),
      };
    case "program_emit_element": {
      const templateId = String(block.getFieldValue("TEMPLATE"));
      const template = ELEMENT_TEMPLATES[templateId];
      const params: Record<string, ProgramNode> = {};
      for (const p of template?.paramSchema ?? []) {
        params[p.key] = compileValue(block.getInputTargetBlock(paramInputName(p.key)));
      }
      return { kind: "emitElement", templateId, params };
    }
    default:
      // Unreachable given the restricted toolbox.
      return { kind: "sequence", body: [] };
  }
}

// Compiles an entire workspace to one ProgramNode (PROG-005's own
// objective: "compiling Blockly's workspace to ProgramNode on every
// edit"). All top-level block chains run in workspace order
// (getTopBlocks(true) sorts top-to-bottom, left-to-right — Blockly's own
// documented ordering for exactly this purpose), concatenated into one
// `sequence`. There is deliberately no dedicated "start" hat block: every
// top-level stack in the workspace is part of the program, in visual
// order, rather than requiring one specific anchor block authors must
// remember to use — simpler for this instruction set's scale, and
// unambiguous since Blockly's own ordering is itself deterministic.
export function compileWorkspaceToProgram(workspace: Blockly.Workspace): ProgramNode {
  const body: ProgramNode[] = [];
  for (const top of workspace.getTopBlocks(true)) {
    body.push(...compileStatementChain(top));
  }
  return { kind: "sequence", body };
}

// The actual editor: injects a Blockly workspace into a div, recompiles to
// a ProgramNode on every real edit (ignoring pure UI events — selection,
// scroll, zoom — via event.isUiEvent), and reports the result upward.
export function BlockEditor({
  controls,
  onChange,
}: {
  controls: { id: string }[];
  onChange: (program: ProgramNode) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

  useEffect(() => {
    setAvailableControlIds(controls.map((c) => c.id));
  }, [controls]);

  useEffect(() => {
    registerProgramBlocks();
    const container = containerRef.current;
    if (!container) return;

    const workspace = Blockly.inject(container, { toolbox: buildToolbox() });
    workspaceRef.current = workspace;

    const listener = (event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return;
      onChange(compileWorkspaceToProgram(workspace));
    };
    workspace.addChangeListener(listener);
    // Report the (empty) starting program immediately, same as any
    // controlled-input component reporting its initial value on mount.
    onChange(compileWorkspaceToProgram(workspace));

    return () => {
      workspace.removeChangeListener(listener);
      workspace.dispose();
      workspaceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange is expected to be stable per the scene builder's own draft-state update pattern (see scene-builder-app.tsx); re-running this effect on every render would re-inject (and visually reset) the whole Blockly workspace.
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="block-editor-workspace"
      className="h-[480px] w-full rounded-md border border-slate-200 dark:border-slate-700"
    />
  );
}
