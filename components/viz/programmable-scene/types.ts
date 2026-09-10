import { ELEMENT_TEMPLATES } from "@/components/viz/composed-scene/element-templates";

// PROG-A1/PROG-A3: the closed instruction set a programmable-scene program
// can be built from. This is the *only* shape a program can ever take —
// the interpreter (interpreter.ts) is a total function over this union, and
// the Blockly authoring UI (components/site/scene-builder/block-editor.tsx)
// compiles a workspace into exactly this shape, never anything else. Kept
// byte-for-byte in sync with the architect spec's §5 type — if this ever
// needs to diverge from the spec's literal definition, that's a signal to
// stop and re-check against the spec, not to drift silently.
export type ProgramNode =
  | { kind: "literal"; value: number | boolean | string }
  | { kind: "variableGet"; name: string }
  | { kind: "variableSet"; name: string; value: ProgramNode }
  | { kind: "input"; name: "t" | `control:${string}` }
  | { kind: "arithmetic"; op: "+" | "-" | "*" | "/"; left: ProgramNode; right: ProgramNode }
  | { kind: "comparison"; op: "<" | "<=" | "=" | ">=" | ">"; left: ProgramNode; right: ProgramNode }
  | { kind: "boolean"; op: "and" | "or" | "not"; args: ProgramNode[] }
  | { kind: "if"; condition: ProgramNode; then: ProgramNode[]; else: ProgramNode[] }
  | { kind: "repeat"; count: ProgramNode; body: ProgramNode[] }
  | { kind: "emitElement"; templateId: string; params: Record<string, ProgramNode> }
  | { kind: "sequence"; body: ProgramNode[] };

export const PROGRAM_NODE_KINDS = [
  "literal",
  "variableGet",
  "variableSet",
  "input",
  "arithmetic",
  "comparison",
  "boolean",
  "if",
  "repeat",
  "emitElement",
  "sequence",
] as const;

const ARITHMETIC_OPS = ["+", "-", "*", "/"] as const;
const COMPARISON_OPS = ["<", "<=", "=", ">=", ">"] as const;
const BOOLEAN_OPS = ["and", "or", "not"] as const;

// Deliberately its own type, not a reuse of composed-scene's SceneControl:
// SceneControl's `bindsTo: { elementId, paramKey }` is meaningless here —
// there's no fixed element to bind to, since the *program* (not a static
// element list) decides what a control's value drives, read generically via
// `{ kind: "input", name: "control:<id>" }` from anywhere in the program.
// Everything else (id/kind/label/min/max/step) mirrors SceneControl's own
// shape exactly, per spec §4's "mirrors ComposedSceneConfig's own shape for
// canvas/controls" — same reader-facing slider/toggle UI, different binding
// mechanism underneath.
export interface ProgramControl {
  id: string;
  kind: "slider" | "toggle";
  label: string;
  min?: number; // sliders
  max?: number;
  step?: number;
}

export interface ProgrammableSceneConfig {
  canvas: { widthPx: number; heightPx: number };
  program: ProgramNode;
  controls?: ProgramControl[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProgramNodeShape(value: unknown): value is ProgramNode {
  if (!isRecord(value)) return false;
  return (PROGRAM_NODE_KINDS as readonly string[]).includes(value.kind as string);
}

// Threads the set of variable names *guaranteed* to be assigned before
// reaching a given point in program order — spec §6's "every referenced
// variableGet has a corresponding variableSet reachable before it in
// program order" requirement, made precise. `then`/`else` and a `repeat`
// body each get their own copy of the incoming set (a branch that runs zero
// or one-of-two times can't guarantee anything for code after it); a
// variable is only carried forward past an `if` when *both* branches assign
// it unconditionally — the standard conservative "definite assignment"
// reading of "reachable before it", not merely "assigned somewhere in the
// program". `variableSet`'s own `value` is checked against the set as it
// stood *before* that assignment (so `x = x + 1` requires `x` already
// set, matching normal evaluation order — the value expression runs before
// the assignment takes effect).
function collectAssigned(
  node: ProgramNode,
  before: ReadonlySet<string>,
  controlIds: ReadonlySet<string>,
  templateIds: ReadonlySet<string>,
): Set<string> | null {
  switch (node.kind) {
    case "literal":
      return new Set(before);
    case "variableGet":
      if (typeof node.name !== "string" || !before.has(node.name)) return null;
      return new Set(before);
    case "variableSet": {
      if (typeof node.name !== "string" || node.name.length === 0) return null;
      const afterValue = collectAssigned(node.value, before, controlIds, templateIds);
      if (!afterValue) return null;
      afterValue.add(node.name);
      return afterValue;
    }
    case "input": {
      if (node.name === "t") return new Set(before);
      if (typeof node.name === "string" && node.name.startsWith("control:")) {
        const controlId = node.name.slice("control:".length);
        if (!controlIds.has(controlId)) return null; // dangling control reference
        return new Set(before);
      }
      return null;
    }
    case "arithmetic": {
      if (!(ARITHMETIC_OPS as readonly string[]).includes(node.op)) return null;
      const afterLeft = collectAssigned(node.left, before, controlIds, templateIds);
      if (!afterLeft) return null;
      return collectAssigned(node.right, afterLeft, controlIds, templateIds);
    }
    case "comparison": {
      if (!(COMPARISON_OPS as readonly string[]).includes(node.op)) return null;
      const afterLeft = collectAssigned(node.left, before, controlIds, templateIds);
      if (!afterLeft) return null;
      return collectAssigned(node.right, afterLeft, controlIds, templateIds);
    }
    case "boolean": {
      if (!(BOOLEAN_OPS as readonly string[]).includes(node.op)) return null;
      if (!Array.isArray(node.args) || node.args.length === 0) return null;
      if (node.op === "not" && node.args.length !== 1) return null;
      let running = before;
      for (const arg of node.args) {
        const next = collectAssigned(arg, running, controlIds, templateIds);
        if (!next) return null;
        running = next;
      }
      return new Set(running);
    }
    case "if": {
      const afterCondition = collectAssigned(node.condition, before, controlIds, templateIds);
      if (!afterCondition) return null;
      if (!Array.isArray(node.then) || !Array.isArray(node.else)) return null;
      const thenResult = collectSequence(node.then, afterCondition, controlIds, templateIds);
      if (!thenResult) return null;
      const elseResult = collectSequence(node.else, afterCondition, controlIds, templateIds);
      if (!elseResult) return null;
      const carried = new Set(afterCondition);
      for (const name of thenResult) {
        if (elseResult.has(name)) carried.add(name);
      }
      return carried;
    }
    case "repeat": {
      const afterCount = collectAssigned(node.count, before, controlIds, templateIds);
      if (!afterCount) return null;
      if (!Array.isArray(node.body)) return null;
      // A repeat may run zero times (spec §6 boundary case), so nothing it
      // assigns is guaranteed afterward — but the body is still validated
      // (using its own accumulating copy) so a variableGet later *within*
      // the same body can see an earlier assignment from the same pass.
      const bodyResult = collectSequence(node.body, afterCount, controlIds, templateIds);
      if (!bodyResult) return null;
      return new Set(afterCount);
    }
    case "emitElement": {
      if (typeof node.templateId !== "string" || !templateIds.has(node.templateId)) return null;
      if (!isRecord(node.params)) return null;
      let running = before;
      for (const value of Object.values(node.params)) {
        if (!isProgramNodeShape(value)) return null;
        const next = collectAssigned(value, running, controlIds, templateIds);
        if (!next) return null;
        running = next;
      }
      return new Set(running);
    }
    case "sequence":
      if (!Array.isArray(node.body)) return null;
      return collectSequence(node.body, before, controlIds, templateIds);
    default:
      return null; // unknown kind — isProgramNodeShape already guards this, unreachable in practice
  }
}

function collectSequence(
  body: unknown[],
  before: ReadonlySet<string>,
  controlIds: ReadonlySet<string>,
  templateIds: ReadonlySet<string>,
): Set<string> | null {
  let running = before;
  for (const stmt of body) {
    if (!isProgramNodeShape(stmt)) return null;
    const next = collectAssigned(stmt, running, controlIds, templateIds);
    if (!next) return null;
    running = next;
  }
  return new Set(running);
}

// Save-time guard (spec §6 "Validation"): a program that fails this check
// cannot be published — the same "invalid config never reaches a reader"
// bar every other engine's own isXConfig guard already holds
// (isComposedSceneConfig, isTrajectorySandboxConfig, etc.). Checks, per
// spec §6: every node is one of the closed set of kinds; every
// `emitElement`'s `templateId` is a real ELEMENT_TEMPLATES entry; every
// `variableGet` (and `control:` input) has a reachable prior assignment /
// declaration.
export function isProgrammableSceneConfig(
  config: unknown,
): config is ProgrammableSceneConfig {
  if (!isRecord(config)) return false;

  const canvas = config.canvas;
  if (!isRecord(canvas)) return false;
  if (
    typeof canvas.widthPx !== "number" ||
    !Number.isFinite(canvas.widthPx) ||
    canvas.widthPx <= 0 ||
    typeof canvas.heightPx !== "number" ||
    !Number.isFinite(canvas.heightPx) ||
    canvas.heightPx <= 0
  ) {
    return false;
  }

  const controlIds = new Set<string>();
  if (config.controls !== undefined) {
    if (!Array.isArray(config.controls)) return false;
    for (const ctrl of config.controls) {
      if (!isRecord(ctrl)) return false;
      if (typeof ctrl.id !== "string" || ctrl.id.length === 0) return false;
      if (ctrl.kind !== "slider" && ctrl.kind !== "toggle") return false;
      if (typeof ctrl.label !== "string") return false;
      // Unlike composed-scene's SceneControl (bound to one element's own
      // param), a programmable-scene control has no `bindsTo` — its live
      // value is read generically via `{ kind: "input", name: "control:<id>" }`
      // from anywhere in the program, since the program (not a fixed
      // element) decides what to do with it.
      if (ctrl.min !== undefined && typeof ctrl.min !== "number") return false;
      if (ctrl.max !== undefined && typeof ctrl.max !== "number") return false;
      if (ctrl.step !== undefined && typeof ctrl.step !== "number") return false;
      controlIds.add(ctrl.id);
    }
  }

  if (!isProgramNodeShape(config.program)) return false;
  const templateIds = new Set(Object.keys(ELEMENT_TEMPLATES));
  const result = collectAssigned(config.program, new Set(), controlIds, templateIds);
  return result !== null;
}
