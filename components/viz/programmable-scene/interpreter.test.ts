import { describe, expect, it } from "vitest";

import { runProgram, MAX_REPEAT, OPERATION_BUDGET } from "./interpreter";
import type { ProgramNode } from "./types";

function lit(value: number | boolean | string): ProgramNode {
  return { kind: "literal", value };
}

function seq(body: ProgramNode[]): ProgramNode {
  return { kind: "sequence", body };
}

function run(program: ProgramNode, t = 0, controls: Record<string, number | boolean> = {}) {
  return runProgram(program, { t, controls });
}

describe("literals", () => {
  it("evaluates number/boolean/string literals to themselves (via variableSet round-trip, since a bare expression has no observable side effect)", () => {
    const result = run(
      seq([
        { kind: "variableSet", name: "n", value: lit(42) },
        { kind: "variableSet", name: "b", value: lit(true) },
        { kind: "variableSet", name: "s", value: lit("blue") },
        {
          kind: "emitElement",
          templateId: "shape-circle",
          params: {
            n: { kind: "variableGet", name: "n" },
            b: { kind: "variableGet", name: "b" },
            s: { kind: "variableGet", name: "s" },
          },
        },
      ]),
    );
    expect(result.elements[0]?.params).toEqual({ n: 42, b: true, s: "blue" });
  });
});

describe("arithmetic", () => {
  const cases: ["+" | "-" | "*" | "/", number, number, number][] = [
    ["+", 2, 3, 5],
    ["-", 5, 3, 2],
    ["*", 4, 3, 12],
    ["/", 9, 3, 3],
  ];

  it.each(cases)("%s evaluates correctly", (op, left, right, expected) => {
    const result = run(
      seq([
        {
          kind: "emitElement",
          templateId: "shape-circle",
          params: { x: { kind: "arithmetic", op, left: lit(left), right: lit(right) } },
        },
      ]),
    );
    expect(result.elements[0]?.params.x).toBe(expected);
  });

  it("divide-by-zero evaluates to 0, not a thrown error (PROG-A3)", () => {
    const result = run(
      seq([
        {
          kind: "emitElement",
          templateId: "shape-circle",
          params: { x: { kind: "arithmetic", op: "/", left: lit(9), right: lit(0) } },
        },
      ]),
    );
    expect(result.elements[0]?.params.x).toBe(0);
    expect(result.budgetExceeded).toBe(false);
  });
});

describe("comparisons", () => {
  const cases: ["<" | "<=" | "=" | ">=" | ">", number, number, boolean][] = [
    ["<", 2, 3, true],
    ["<", 3, 2, false],
    ["<=", 3, 3, true],
    ["=", 3, 3, true],
    ["=", 3, 4, false],
    [">=", 3, 3, true],
    [">", 4, 3, true],
    [">", 3, 4, false],
  ];

  it.each(cases)("%s %d %d -> %s", (op, left, right, expected) => {
    const result = run(
      seq([
        {
          kind: "emitElement",
          templateId: "shape-circle",
          params: { x: { kind: "comparison", op, left: lit(left), right: lit(right) } },
        },
      ]),
    );
    expect(result.elements[0]?.params.x).toBe(expected);
  });

  it("'=' on mismatched types is false, not a coercing comparison", () => {
    const result = run(
      seq([
        {
          kind: "emitElement",
          templateId: "shape-circle",
          params: { x: { kind: "comparison", op: "=", left: lit(1), right: lit("1") } },
        },
      ]),
    );
    expect(result.elements[0]?.params.x).toBe(false);
  });
});

describe("boolean ops", () => {
  it("and/or/not evaluate correctly, including N-ary and/or", () => {
    const andAll: ProgramNode = { kind: "boolean", op: "and", args: [lit(true), lit(true), lit(true)] };
    const andOne: ProgramNode = { kind: "boolean", op: "and", args: [lit(true), lit(false)] };
    const orAny: ProgramNode = { kind: "boolean", op: "or", args: [lit(false), lit(false), lit(true)] };
    const orNone: ProgramNode = { kind: "boolean", op: "or", args: [lit(false), lit(false)] };
    const notTrue: ProgramNode = { kind: "boolean", op: "not", args: [lit(true)] };

    function evalBool(node: ProgramNode): unknown {
      return run(
        seq([{ kind: "emitElement", templateId: "shape-circle", params: { x: node } }]),
      ).elements[0]?.params.x;
    }

    expect(evalBool(andAll)).toBe(true);
    expect(evalBool(andOne)).toBe(false);
    expect(evalBool(orAny)).toBe(true);
    expect(evalBool(orNone)).toBe(false);
    expect(evalBool(notTrue)).toBe(false);
  });
});

describe("if — both branches (PROG-001)", () => {
  it("runs the then branch when the condition is true, and only that branch", () => {
    const program = seq([
      {
        kind: "if",
        condition: lit(true),
        then: [{ kind: "emitElement", templateId: "shape-circle", params: {} }],
        else: [{ kind: "emitElement", templateId: "shape-rect", params: {} }],
      },
    ]);
    const result = run(program);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.templateId).toBe("shape-circle");
  });

  it("runs the else branch when the condition is false, and only that branch", () => {
    const program = seq([
      {
        kind: "if",
        condition: lit(false),
        then: [{ kind: "emitElement", templateId: "shape-circle", params: {} }],
        else: [{ kind: "emitElement", templateId: "shape-rect", params: {} }],
      },
    ]);
    const result = run(program);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.templateId).toBe("shape-rect");
  });
});

describe("variableGet / variableSet ordering", () => {
  it("a variable set earlier is visible to a later get", () => {
    const program = seq([
      { kind: "variableSet", name: "x", value: lit(7) },
      {
        kind: "emitElement",
        templateId: "shape-circle",
        params: { x: { kind: "variableGet", name: "x" } },
      },
    ]);
    expect(run(program).elements[0]?.params.x).toBe(7);
  });

  it("a variable set inside a repeat's body is visible to a later statement within the same body", () => {
    const program = seq([
      { kind: "variableSet", name: "x", value: lit(0) },
      {
        kind: "repeat",
        count: lit(3),
        body: [
          {
            kind: "variableSet",
            name: "x",
            value: { kind: "arithmetic", op: "+", left: { kind: "variableGet", name: "x" }, right: lit(1) },
          },
        ],
      },
      {
        kind: "emitElement",
        templateId: "shape-circle",
        params: { x: { kind: "variableGet", name: "x" } },
      },
    ]);
    expect(run(program).elements[0]?.params.x).toBe(3);
  });
});

describe("repeat bounds (PROG-A3)", () => {
  function countEmits(count: ProgramNode): number {
    const program = seq([{ kind: "repeat", count, body: [{ kind: "emitElement", templateId: "shape-circle", params: {} }] }]);
    return run(program).elements.length;
  }

  it("count = 0 -> 0 iterations, no error", () => {
    expect(countEmits(lit(0))).toBe(0);
  });

  it("negative count -> 0 iterations, no error", () => {
    expect(countEmits(lit(-5))).toBe(0);
  });

  it("count exactly MAX_REPEAT -> MAX_REPEAT iterations (capped below MAX_ELEMENTS in this case is irrelevant since MAX_REPEAT is checked here with a cap-safe count)", () => {
    // MAX_REPEAT (64) exceeds MAX_ELEMENTS (12), so this exercises the
    // MAX_ELEMENTS cap, not the repeat-count clamp itself — see the
    // dedicated "clamped to MAX_REPEAT" test below for that, which reads
    // budgetExceeded/iteration count indirectly via a variable increment
    // instead of emitted elements.
    expect(countEmits(lit(MAX_REPEAT))).toBe(12);
  });

  it("count above MAX_REPEAT is clamped to MAX_REPEAT, not the raw count (verified via a counter variable, unaffected by MAX_ELEMENTS)", () => {
    const program = seq([
      { kind: "variableSet", name: "n", value: lit(0) },
      {
        kind: "repeat",
        count: lit(MAX_REPEAT + 1000),
        body: [
          {
            kind: "variableSet",
            name: "n",
            value: { kind: "arithmetic", op: "+", left: { kind: "variableGet", name: "n" }, right: lit(1) },
          },
        ],
      },
      { kind: "emitElement", templateId: "shape-circle", params: { n: { kind: "variableGet", name: "n" } } },
    ]);
    expect(run(program).elements[0]?.params.n).toBe(MAX_REPEAT);
  });
});

describe("operation budget (PROG-R1 — the highest-risk requirement)", () => {
  it("is enforced per-node, not per-loop-iteration: a repeat with a long per-iteration operation chain trips budgetExceeded even though the iteration *count* alone is far below the budget", () => {
    // 64 iterations (well under OPERATION_BUDGET on its own) x a ~100-node
    // arithmetic chain per iteration = ~6400+ node evaluations, which only
    // exceeds OPERATION_BUDGET if the budget counter increments on *every*
    // node evaluated — not just once per top-level statement or once per
    // loop iteration. A buggy "per-iteration-only" counter would see only
    // ~64 "steps" here and never trip budgetExceeded at all.
    let chain: ProgramNode = lit(1);
    for (let i = 0; i < 100; i++) {
      chain = { kind: "arithmetic", op: "+", left: chain, right: lit(1) };
    }
    const program: ProgramNode = {
      kind: "repeat",
      count: lit(MAX_REPEAT),
      body: [{ kind: "variableSet", name: "x", value: chain }],
    };
    const result = run(program);
    expect(result.budgetExceeded).toBe(true);
  });

  it("a runaway nested repeat around emitElement still yields exactly MAX_ELEMENTS elements, no error — and completes within budget given this instruction set's own default caps", () => {
    const program: ProgramNode = {
      kind: "repeat",
      count: lit(MAX_REPEAT),
      body: [
        {
          kind: "repeat",
          count: lit(MAX_REPEAT),
          body: [{ kind: "emitElement", templateId: "shape-circle", params: {} }],
        },
      ],
    };
    const result = run(program);
    expect(result.elements).toHaveLength(12); // MAX_ELEMENTS
    expect(result.budgetExceeded).toBe(false);
  });

  it("keeps whatever elements were already emitted before the budget cutoff, rather than discarding them", () => {
    // Each iteration emits one element (cheap: 1 tick for emitElement, no
    // params) *and* burns a large fixed number of extra ticks via a long
    // chain — so a handful of elements are emitted before the very small
    // budget below is exhausted mid-way through the loop.
    let waste: ProgramNode = lit(1);
    for (let i = 0; i < 20; i++) {
      waste = { kind: "arithmetic", op: "+", left: waste, right: lit(1) };
    }
    const program: ProgramNode = {
      kind: "repeat",
      count: lit(MAX_REPEAT),
      body: [
        { kind: "emitElement", templateId: "shape-circle", params: {} },
        { kind: "variableSet", name: "_", value: waste },
      ],
    };
    const result = runProgram(program, { t: 0, controls: {} }, 50);
    expect(result.budgetExceeded).toBe(true);
    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.elements.length).toBeLessThan(12);
  });

  it("a program landing exactly on the budget completes without tripping budgetExceeded", () => {
    // sequence(1) + emitElement(1) = exactly 2 node evaluations.
    const program = seq([{ kind: "emitElement", templateId: "shape-circle", params: {} }]);
    const result = runProgram(program, { t: 0, controls: {} }, 2);
    expect(result.budgetExceeded).toBe(false);
  });

  it("OPERATION_BUDGET is the default when no explicit budget is passed", () => {
    const result = run(seq([{ kind: "emitElement", templateId: "shape-circle", params: {} }]));
    expect(result.budgetExceeded).toBe(false);
    expect(OPERATION_BUDGET).toBeGreaterThan(0);
  });
});

describe("emitElement cap (MAX_ELEMENTS, shared with composed-scene)", () => {
  it("silently drops elements past the cap rather than erroring", () => {
    const body: ProgramNode[] = [];
    for (let i = 0; i < 20; i++) {
      body.push({ kind: "emitElement", templateId: "shape-circle", params: {} });
    }
    const result = run(seq(body));
    expect(result.elements).toHaveLength(12);
    expect(result.budgetExceeded).toBe(false);
  });
});

describe("inputs: t and control values", () => {
  it("reads elapsed time via { kind: 'input', name: 't' }", () => {
    const program = seq([
      { kind: "emitElement", templateId: "shape-circle", params: { x: { kind: "input", name: "t" } } },
    ]);
    expect(run(program, 12.5).elements[0]?.params.x).toBe(12.5);
  });

  it("reads a declared control's live value via { kind: 'input', name: 'control:<id>' }", () => {
    const program = seq([
      {
        kind: "emitElement",
        templateId: "shape-circle",
        params: { x: { kind: "input", name: "control:speed" } },
      },
    ]);
    expect(run(program, 0, { speed: 42 }).elements[0]?.params.x).toBe(42);
  });
});

describe("empty program (spec §6 — a legitimate, non-error state)", () => {
  it("a sequence with no body emits zero elements, no error", () => {
    const result = run(seq([]));
    expect(result.elements).toEqual([]);
    expect(result.budgetExceeded).toBe(false);
  });

  it("an if branch that emits nothing renders an empty canvas for that tick", () => {
    const program = seq([{ kind: "if", condition: lit(false), then: [{ kind: "emitElement", templateId: "shape-circle", params: {} }], else: [] }]);
    expect(run(program).elements).toEqual([]);
  });
});
