import { MAX_ELEMENTS, type SceneElement } from "@/components/viz/composed-scene/types";
import type { ResolvedParams } from "@/components/viz/composed-scene/element-templates";
import type { ProgramNode } from "./types";

// PROG-A3: `repeat`'s `count` is clamped into this range *before* the loop
// runs at all (never re-evaluated per iteration), so a `repeat` can never
// itself become unbounded regardless of what its `count` expression
// computes to (spec §5).
export const MAX_REPEAT = 64;

// PROG-A4's own example figure, adopted as the actual default: the hard
// per-tick ceiling on evaluated AST nodes. Chosen (together with
// MAX_REPEAT/MAX_ELEMENTS above) so the worst-case "runaway nested repeat"
// case in §8's testing spec — repeat MAX_REPEAT { repeat MAX_REPEAT {
// emitElement } } — completes well within budget (≈4.2k node evaluations
// for an empty-params emitElement) rather than tripping budgetExceeded,
// while a genuinely pathological program (e.g. a long operation chain
// repeated MAX_REPEAT times) still trips it. See interpreter.test.ts for
// both cases exercised directly.
export const OPERATION_BUDGET = 5000;

export interface RunProgramInputs {
  /** Elapsed seconds since the scene mounted — matches trajectory-sandbox's own `t` convention (spec §5). */
  t: number;
  /** Each declared control's current live value, read-only, keyed by control id (not `control:<id>` — callers pass the bare id). */
  controls: Record<string, number | boolean>;
}

export interface RunProgramResult {
  elements: SceneElement[];
  budgetExceeded: boolean;
}

type Value = number | boolean | string;

// Internal control-flow signal only — thrown to unwind evaluation the
// instant the budget is exceeded (spec §5: "the moment it exceeds budget,
// evaluation stops immediately"), caught inside runProgram itself. Never
// escapes this module; nothing outside interpreter.ts ever sees it. Not a
// reader-visible "thrown error" (NFR-1's "never a thrown error mid-program"
// is about the *program's own* semantics — division by zero, an
// out-of-range repeat count, and so on — all of which resolve to a defined
// value rather than an exception; a genuine budget cutoff is instead
// reported back as data via `budgetExceeded`, per spec §6's "Partial
// failure" behaviour).
class BudgetExceededSignal {}

interface EvalState {
  variables: Record<string, Value>;
  elements: SceneElement[];
  steps: number;
  budget: number;
  t: number;
  controls: Record<string, number | boolean>;
}

function tick(state: EvalState): void {
  state.steps += 1;
  // Strictly greater-than: a program that lands *exactly* on the budget is
  // allowed to finish its current node — the cutoff is "the first node that
  // would push the count past the budget", not an off-by-one-early stop.
  if (state.steps > state.budget) throw new BudgetExceededSignal();
}

function toNumber(value: Value): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: Value): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return value.length > 0;
}

// "=" compares like-typed values structurally; a type mismatch (e.g.
// comparing a number to a string) is simply `false` rather than an error or
// a surprising cross-type coercion — deterministic, never throws, matching
// every other operator in this interpreter (spec §5/§6's "no program,
// however written, can... crash" NFR).
function valuesEqual(a: Value, b: Value): boolean {
  if (typeof a !== typeof b) return false;
  return a === b;
}

function evalNode(node: ProgramNode, state: EvalState): Value {
  tick(state);

  switch (node.kind) {
    case "literal":
      return node.value;

    case "variableGet":
      // Falls back to 0 for an unset variable rather than throwing —
      // defense-in-depth only. isProgrammableSceneConfig (types.ts) already
      // rejects any program with a variableGet lacking a reachable prior
      // variableSet before it's ever saved, so this path is unreachable for
      // a published program; it only guards a hand-edited/fixture config.
      return state.variables[node.name] ?? 0;

    case "variableSet": {
      const value = evalNode(node.value, state);
      state.variables[node.name] = value;
      return value;
    }

    case "input":
      if (node.name === "t") return state.t;
      // node.name is `control:${string}` here (the only other legal
      // `input.name` shape); strip the prefix to get the bare control id
      // callers key `inputs.controls` by.
      return state.controls[node.name.slice("control:".length)] ?? 0;

    case "arithmetic": {
      const left = toNumber(evalNode(node.left, state));
      const right = toNumber(evalNode(node.right, state));
      if (node.op === "+") return left + right;
      if (node.op === "-") return left - right;
      if (node.op === "*") return left * right;
      // node.op === "/". PROG-A3: divide-by-zero -> 0, never a thrown error mid-program.
      return right === 0 ? 0 : left / right;
    }

    case "comparison": {
      const leftVal = evalNode(node.left, state);
      const rightVal = evalNode(node.right, state);
      if (node.op === "=") return valuesEqual(leftVal, rightVal);
      const left = toNumber(leftVal);
      const right = toNumber(rightVal);
      if (node.op === "<") return left < right;
      if (node.op === "<=") return left <= right;
      if (node.op === ">=") return left >= right;
      return left > right; // node.op === ">"
    }

    case "boolean": {
      if (node.op === "not") {
        const arg = node.args[0];
        return arg === undefined ? true : !toBoolean(evalNode(arg, state));
      }
      // "and"/"or" over N args (PROG-A3's args: ProgramNode[]), evaluated
      // left-to-right. Every arg is evaluated (no short-circuiting) — each
      // still costs its own budget tick either way, and short-circuiting
      // would make the operation-budget cost of a boolean expression depend
      // on runtime values rather than its static shape, which would only
      // complicate reasoning about worst-case budget consumption for no
      // real benefit at this instruction set's scale.
      const values = node.args.map((arg) => toBoolean(evalNode(arg, state)));
      return node.op === "and" ? values.every(Boolean) : values.some(Boolean);
    }

    case "if": {
      const branch = toBoolean(evalNode(node.condition, state)) ? node.then : node.else;
      for (const stmt of branch) evalNode(stmt, state);
      return false; // if/repeat/sequence are evaluated for effect, not value — see runProgram's own top-level handling.
    }

    case "repeat": {
      // Evaluated once, clamped *before* the loop body ever runs — see
      // this module's own header comment and spec §5. Math.floor rather
      // than truncation-toward-zero: a negative count (e.g. -2.5) still
      // clamps to 0 via Math.max below regardless.
      const rawCount = Math.floor(toNumber(evalNode(node.count, state)));
      const count = Math.min(Math.max(rawCount, 0), MAX_REPEAT);
      for (let i = 0; i < count; i++) {
        for (const stmt of node.body) evalNode(stmt, state);
      }
      return false;
    }

    case "emitElement": {
      const resolved: ResolvedParams = {};
      // Every param expression is still evaluated (and still costs budget
      // ticks) even once the element cap is reached below — only the
      // *push* is skipped. This is what keeps a runaway `repeat` around an
      // `emitElement` bounded in *elements* (MAX_ELEMENTS) without also
      // needing a separate, harder-to-reason-about "stop evaluating
      // entirely" rule; the operation budget alone still bounds total work.
      for (const [key, valueNode] of Object.entries(node.params)) {
        resolved[key] = evalNode(valueNode, state);
      }
      if (state.elements.length < MAX_ELEMENTS) {
        state.elements.push({
          id: `prog-el-${state.elements.length}`,
          templateId: node.templateId,
          params: resolved,
        });
      }
      return false;
    }

    case "sequence":
      for (const stmt of node.body) evalNode(stmt, state);
      return false;
  }
}

// The interpreter's entire public surface: a pure function, `(program, t,
// controlValues) -> SceneElement[]` (plus the budget-exceeded flag) — no
// DOM access, no side effects outside its own return value, trivially
// sandboxed by construction (spec §3, PROG-A1). Re-initializes its variable
// table fresh on every call — no state persists between ticks (PROG-A3: "no
// closures" scoping choice; also spec §5's own note that this sidesteps an
// entire category of cross-frame state-corruption bugs).
export function runProgram(
  program: ProgramNode,
  inputs: RunProgramInputs,
  budget: number = OPERATION_BUDGET,
): RunProgramResult {
  const state: EvalState = {
    variables: {},
    elements: [],
    steps: 0,
    budget,
    t: inputs.t,
    controls: inputs.controls,
  };
  try {
    evalNode(program, state);
    return { elements: state.elements, budgetExceeded: false };
  } catch (err) {
    if (err instanceof BudgetExceededSignal) {
      return { elements: state.elements, budgetExceeded: true };
    }
    throw err; // Should be unreachable — evalNode's switch is total over ProgramNode's closed kind union.
  }
}
