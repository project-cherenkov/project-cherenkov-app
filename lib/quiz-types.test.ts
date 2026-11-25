import { describe, expect, it } from "vitest";
import {
  gradeResponse,
  isWithinTolerance,
  parseAnswerKey,
  parseNumericInput,
  parseQuestionContent,
  revealAnswer,
  storedResponse,
  toServerQuestion,
  validateResponse,
  type AnswerKey,
  type QuestionContent,
} from "./quiz-types";

const single: QuestionContent = { type: "single_choice", choices: ["a", "b", "c"] };
const multi: QuestionContent = { type: "multiple_select", choices: ["a", "b", "c", "d"] };
const tf: QuestionContent = { type: "true_false_set", statements: ["s1", "s2", "s3"] };
const num: QuestionContent = { type: "numeric_response", unit: "au" };

describe("validateResponse", () => {
  it("accepts a well-formed response for each type", () => {
    expect(validateResponse(single, { type: "single_choice", choiceIndex: 2 })).toEqual({ type: "single_choice", choiceIndex: 2 });
    expect(validateResponse(multi, { type: "multiple_select", choiceIndices: [3, 0] })).toEqual({ type: "multiple_select", choiceIndices: [0, 3] });
    expect(validateResponse(tf, { type: "true_false_set", values: [true, false, true] })).toEqual({ type: "true_false_set", values: [true, false, true] });
    expect(validateResponse(num, { type: "numeric_response", value: 2.35 })).toEqual({ type: "numeric_response", value: 2.35 });
  });

  it.each([
    ["a response of the wrong type", single, { type: "multiple_select", choiceIndices: [0] }],
    ["an untyped response", single, { choiceIndex: 0 }],
    ["null", single, null],
    ["a string", single, "0"],
    ["a negative single index", single, { type: "single_choice", choiceIndex: -1 }],
    ["an out-of-range single index", single, { type: "single_choice", choiceIndex: 3 }],
    ["a fractional single index", single, { type: "single_choice", choiceIndex: 0.5 }],
    ["a string single index", single, { type: "single_choice", choiceIndex: "1" }],
    ["an empty multi-select", multi, { type: "multiple_select", choiceIndices: [] }],
    ["duplicate multi-select indices", multi, { type: "multiple_select", choiceIndices: [1, 1] }],
    ["an out-of-range multi-select index", multi, { type: "multiple_select", choiceIndices: [0, 4] }],
    ["a negative multi-select index", multi, { type: "multiple_select", choiceIndices: [-1, 0] }],
    ["a non-array multi-select", multi, { type: "multiple_select", choiceIndices: 1 }],
    ["a short true/false vector", tf, { type: "true_false_set", values: [true, false] }],
    ["a long true/false vector", tf, { type: "true_false_set", values: [true, false, true, true] }],
    ["a non-boolean true/false element", tf, { type: "true_false_set", values: [true, "false", true] }],
    ["a null true/false element", tf, { type: "true_false_set", values: [true, null, true] }],
    ["NaN", num, { type: "numeric_response", value: Number.NaN }],
    ["Infinity", num, { type: "numeric_response", value: Infinity }],
    ["-Infinity", num, { type: "numeric_response", value: -Infinity }],
    ["a numeric string", num, { type: "numeric_response", value: "2.35" }],
    ["a missing numeric value", num, { type: "numeric_response" }],
  ])("rejects %s", (_name, content, response) => {
    expect(validateResponse(content, response)).toBeNull();
  });
});

describe("gradeResponse", () => {
  it("single_choice: correct only for the keyed index", () => {
    const key: AnswerKey = { type: "single_choice", correctChoiceIndex: 1 };
    expect(gradeResponse(key, { type: "single_choice", choiceIndex: 1 })).toBe(true);
    expect(gradeResponse(key, { type: "single_choice", choiceIndex: 0 })).toBe(false);
  });

  it("multiple_select: exact set match, order-insensitive, all-or-nothing", () => {
    const key: AnswerKey = { type: "multiple_select", correctChoiceIndices: [0, 2] };
    expect(gradeResponse(key, { type: "multiple_select", choiceIndices: [0, 2] })).toBe(true);
    expect(gradeResponse(key, { type: "multiple_select", choiceIndices: [2, 0] })).toBe(true);
    expect(gradeResponse(key, { type: "multiple_select", choiceIndices: [0] })).toBe(false); // missing one
    expect(gradeResponse(key, { type: "multiple_select", choiceIndices: [0, 1, 2] })).toBe(false); // extra one
    expect(gradeResponse(key, { type: "multiple_select", choiceIndices: [1, 3] })).toBe(false);
  });

  it("true_false_set: exact vector match in statement order, all-or-nothing", () => {
    const key: AnswerKey = { type: "true_false_set", truthValues: [true, false, true] };
    expect(gradeResponse(key, { type: "true_false_set", values: [true, false, true] })).toBe(true);
    expect(gradeResponse(key, { type: "true_false_set", values: [true, false, false] })).toBe(false); // one wrong
    expect(gradeResponse(key, { type: "true_false_set", values: [false, true, false] })).toBe(false);
  });

  it("a response of a different type than the key is never correct", () => {
    expect(gradeResponse({ type: "single_choice", correctChoiceIndex: 0 }, { type: "numeric_response", value: 0 })).toBe(false);
  });

  describe("numeric_response tolerance", () => {
    const key: AnswerKey = { type: "numeric_response", value: 2.35, tolerance: 0.01 };
    const grade = (value: number) => gradeResponse(key, { type: "numeric_response", value });

    it("accepts the exact value and both exact tolerance boundaries", () => {
      expect(grade(2.35)).toBe(true);
      expect(grade(2.36)).toBe(true); // 2.36 - 2.35 is 0.010000000000000231 in binary
      expect(grade(2.34)).toBe(true);
    });
    it("rejects values outside the tolerance", () => {
      expect(grade(2.3601)).toBe(false);
      expect(grade(2.3399)).toBe(false);
      expect(grade(0)).toBe(false);
      expect(grade(-2.35)).toBe(false);
    });
    it("a zero tolerance means exact equality", () => {
      const exact: AnswerKey = { type: "numeric_response", value: 0.1, tolerance: 0 };
      expect(gradeResponse(exact, { type: "numeric_response", value: 0.1 })).toBe(true);
      expect(gradeResponse(exact, { type: "numeric_response", value: 0.1000001 })).toBe(false);
    });
    it("works for very large and very small magnitudes", () => {
      expect(isWithinTolerance(6.02e23 + 1e20, 6.02e23, 1e20)).toBe(true);
      expect(isWithinTolerance(6.02e23 + 2e20, 6.02e23, 1e20)).toBe(false);
      expect(isWithinTolerance(1.6e-19, 1.6e-19, 0)).toBe(true);
      expect(isWithinTolerance(1.7e-19, 1.6e-19, 0.05e-19)).toBe(false);
      expect(isWithinTolerance(1.65e-19, 1.6e-19, 0.05e-19)).toBe(true);
      expect(isWithinTolerance(1e-30, 0, 0)).toBe(false);
    });
  });
});

describe("parseNumericInput", () => {
  it.each([
    ["2.35", 2.35], ["2,35", 2.35], [" 7 ", 7], ["-1.5", -1.5], ["\u22121.5", -1.5],
    ["+3", 3], [".5", 0.5], ["5.", 5], ["1e3", 1000], ["1,5E-3", 0.0015], ["0", 0],
  ])("parses %s", (text, value) => expect(parseNumericInput(text)).toBe(value));

  it.each(["", "  ", "abc", "1.2.3", "1,000.5", "1 000", "0x10", "NaN", "Infinity", "-Infinity", "1e", "e5", "--1", "2.35 au", "1e999"])(
    "rejects %j",
    (text) => expect(parseNumericInput(text)).toBeNull(),
  );
});

describe("parseQuestionContent / parseAnswerKey / toServerQuestion (corrupt rows)", () => {
  it("parses well-formed jsonb", () => {
    expect(parseQuestionContent({ type: "numeric_response", unit: "au" })).toEqual(num);
    const q = toServerQuestion("q", multi, { type: "multiple_select", correctChoiceIndices: [2, 0] });
    expect(q?.answerKey).toEqual({ type: "multiple_select", correctChoiceIndices: [0, 2] });
  });

  it.each([
    ["null content", null, { type: "single_choice", correctChoiceIndex: 0 }],
    ["unknown type", { type: "essay" }, { type: "essay" }],
    ["choices not strings", { type: "single_choice", choices: [1, 2] }, { type: "single_choice", correctChoiceIndex: 0 }],
    ["key type differs from content type", single, { type: "multiple_select", correctChoiceIndices: [0, 1] }],
    ["single index out of range", single, { type: "single_choice", correctChoiceIndex: 3 }],
    ["multi index out of range", multi, { type: "multiple_select", correctChoiceIndices: [0, 9] }],
    ["multi empty", multi, { type: "multiple_select", correctChoiceIndices: [] }],
    ["multi duplicates", multi, { type: "multiple_select", correctChoiceIndices: [1, 1] }],
    ["tf wrong length", tf, { type: "true_false_set", truthValues: [true] }],
    ["tf non-boolean", tf, { type: "true_false_set", truthValues: [true, 1, false] }],
    ["numeric NaN value", num, { type: "numeric_response", value: Number.NaN, tolerance: 0 }],
    ["numeric negative tolerance", num, { type: "numeric_response", value: 1, tolerance: -1 }],
    ["numeric missing tolerance", num, { type: "numeric_response", value: 1 }],
  ])("yields null for %s", (_name, content, key) => {
    expect(toServerQuestion("q", content, key)).toBeNull();
  });
  it("parseAnswerKey never accepts a key for different content", () => {
    expect(parseAnswerKey({ type: "numeric_response", value: 1, tolerance: 0 }, single)).toBeNull();
  });
});

describe("revealAnswer", () => {
  it("adds the unit to a numeric key and passes other keys through", () => {
    expect(revealAnswer({ content: num, answerKey: { type: "numeric_response", value: 2.35, tolerance: 0.01 } })).toEqual({
      type: "numeric_response", value: 2.35, tolerance: 0.01, unit: "au",
    });
    expect(revealAnswer({ content: tf, answerKey: { type: "true_false_set", truthValues: [true, false, true] } })).toEqual({
      type: "true_false_set", truthValues: [true, false, true],
    });
  });
});

describe("storedResponse (history compatibility)", () => {
  it("prefers the type-neutral response", () => {
    expect(storedResponse({ response: { type: "multiple_select", choiceIndices: [0, 1] }, selectedChoiceIndex: null })).toEqual({
      type: "multiple_select", choiceIndices: [0, 1],
    });
  });
  it("reads a legacy row that only has selected_choice_index as single_choice", () => {
    expect(storedResponse({ response: null, selectedChoiceIndex: 2 })).toEqual({ type: "single_choice", choiceIndex: 2 });
    expect(storedResponse({ selectedChoiceIndex: 0 })).toEqual({ type: "single_choice", choiceIndex: 0 });
  });
  it("returns null when nothing was recorded or the json is malformed", () => {
    expect(storedResponse({ response: null, selectedChoiceIndex: null })).toBeNull();
    expect(storedResponse({ response: { type: "numeric_response", value: "x" }, selectedChoiceIndex: null })).toBeNull();
    expect(storedResponse({ response: 5 })).toBeNull();
  });
});
