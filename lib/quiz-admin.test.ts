import { describe, expect, it } from "vitest";
import { parseQuizArchivePatch, quizQuestionSource } from "./quiz-admin";

describe("parseQuizArchivePatch", () => {
  it("accepts an archive state", () => {
    expect(parseQuizArchivePatch({ archived: true })).toEqual({ ok: true, value: { archived: true } });
    expect(parseQuizArchivePatch({ archived: false })).toEqual({ ok: true, value: { archived: false } });
  });

  it("ignores every other field, so content cannot be changed through this endpoint", () => {
    const parsed = parseQuizArchivePatch({ archived: true, prompt: "x", correctChoiceIndex: 3, status: "reviewed" });
    expect(parsed).toEqual({ ok: true, value: { archived: true } });
  });

  it("rejects a missing or non-boolean archive state and non-objects", () => {
    for (const bad of [{}, { archived: "yes" }, { archived: 1 }, null, [], "x"]) {
      expect(parseQuizArchivePatch(bad).ok).toBe(false);
    }
  });
});

describe("quizQuestionSource", () => {
  it("reports git for keyed questions and database for admin.* or keyless rows", () => {
    expect(quizQuestionSource("physics.vectors.basic.1")).toBe("git");
    expect(quizQuestionSource("admin.0b9f")).toBe("database");
    expect(quizQuestionSource(null)).toBe("database");
  });
});

import { summarizeQuestionForAdmin } from "./quiz-admin";
describe("summarizeQuestionForAdmin", () => {
  it("summarises each type for editors", () => {
    expect(summarizeQuestionForAdmin({ type: "single_choice", choices: ["a", "b"] }, { type: "single_choice", correctChoiceIndex: 1 })).toEqual(["· a", "✓ b"]);
    expect(summarizeQuestionForAdmin({ type: "multiple_select", choices: ["a", "b", "c"] }, { type: "multiple_select", correctChoiceIndices: [0, 2] })).toEqual(["✓ a", "· b", "✓ c"]);
    expect(summarizeQuestionForAdmin({ type: "true_false_set", statements: ["x", "y", "z"] }, { type: "true_false_set", truthValues: [true, false, true] })).toEqual(["True  — x", "False — y", "True  — z"]);
    expect(summarizeQuestionForAdmin({ type: "numeric_response", unit: "au" }, { type: "numeric_response", value: 2.35, tolerance: 0.01 })).toEqual(["2.35 au (± 0.01 au)"]);
  });
  it("reports a malformed row instead of throwing", () => {
    expect(summarizeQuestionForAdmin({ type: "essay" }, null)[0]).toContain("Malformed");
  });
});
