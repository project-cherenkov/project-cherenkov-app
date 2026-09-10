import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// PROG-006 / PROG-R2: "prove the design assumption holds" — PROG-A1's
// entire safety story rests on the program only ever computing data,
// walked by hand-written interpreter code, never on dynamically
// generating and executing JavaScript. This test audits the actual source
// text of every file this feature touches for the ways that assumption
// could be violated, rather than trusting a code-review pass to have
// caught it — a real regression here (someone reaching for `eval` to
// "simplify" the interpreter, or wiring up Blockly's own JS generator
// instead of hand-walking the block tree) fails CI immediately instead of
// needing to be spotted in review.
//
// This is a plain source-text scan, deliberately — it does not need a
// parser or an AST: `eval`/`new Function`/a generator import are supposed
// to never appear at all, in any form (including inside a comment
// *demonstrating* the pattern, which is why the banned-pattern regexes
// below are intentionally broad rather than narrowly matching only "real"
// call sites).
const FEATURE_FILES = [
  "components/viz/programmable-scene/types.ts",
  "components/viz/programmable-scene/interpreter.ts",
  "components/viz/programmable-scene/index.tsx",
  "components/site/scene-builder/block-editor.tsx",
];

function readFeatureFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

// Matches eval(...), a bare `eval` reference, `new Function(...)`, and a
// bare `Function(...)` call — but not the TYPE `Function` used as a plain
// type annotation (e.g. `(fn: Function)`), which is common, harmless, and
// unrelated to dynamic code execution. Excluding that keeps this a
// meaningful check rather than one that would also have to special-case
// this very file's own doc comments listing the banned patterns.
const EVAL_PATTERN = /\beval\s*\(/;
const NEW_FUNCTION_PATTERN = /\bnew\s+Function\s*\(/;
const FUNCTION_CALL_PATTERN = /(?<!new\s)\bFunction\s*\(/;

// Any Blockly code-generator language module — not just JavaScript.
// Blockly ships one per target language (dart/lua/php/python/javascript);
// this feature must never invoke any of them, only its own hand-written
// compiler (block-editor.tsx's compileWorkspaceToProgram).
const BLOCKLY_GENERATOR_IMPORT_PATTERN = /from\s+["']blockly\/(javascript|dart|lua|php|python)["']/;

describe("PROG-006 — no eval/Function/Blockly-generator usage anywhere in this feature", () => {
  it.each(FEATURE_FILES)("%s contains no eval(...) call", (file) => {
    expect(readFeatureFile(file)).not.toMatch(EVAL_PATTERN);
  });

  it.each(FEATURE_FILES)("%s contains no `new Function(...)` construction", (file) => {
    expect(readFeatureFile(file)).not.toMatch(NEW_FUNCTION_PATTERN);
  });

  it.each(FEATURE_FILES)("%s contains no bare Function(...) call", (file) => {
    expect(readFeatureFile(file)).not.toMatch(FUNCTION_CALL_PATTERN);
  });

  it.each(FEATURE_FILES)("%s never imports a Blockly code-generator language module", (file) => {
    expect(readFeatureFile(file)).not.toMatch(BLOCKLY_GENERATOR_IMPORT_PATTERN);
  });

  it("block-editor.tsx imports only blockly/core, never the top-level 'blockly' package (which re-exports the JavaScript generator)", () => {
    const source = readFeatureFile("components/site/scene-builder/block-editor.tsx");
    expect(source).toMatch(/from\s+["']blockly\/core["']/);
    expect(source).not.toMatch(/from\s+["']blockly["']/);
  });

  it("sanity check: the banned-pattern regexes actually catch a real violation (so a future refactor of this test can't silently no-op)", () => {
    expect("eval(userInput)").toMatch(EVAL_PATTERN);
    expect("new Function('return 1')").toMatch(NEW_FUNCTION_PATTERN);
    expect("Function('return 1')()").toMatch(FUNCTION_CALL_PATTERN);
    expect('import { javascriptGenerator } from "blockly/javascript"').toMatch(
      BLOCKLY_GENERATOR_IMPORT_PATTERN,
    );
    // And confirm the Function-type-annotation exclusion actually excludes
    // what it's meant to, so it can't be masking a real violation nearby.
    expect("function run(fn: Function) {}").not.toMatch(FUNCTION_CALL_PATTERN);
  });
});
