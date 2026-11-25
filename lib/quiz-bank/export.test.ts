import { describe, expect, it } from "vitest";
import { planDbExport, type DbOnlyQuestionRow } from "./export";

const row = (patch: Partial<DbOnlyQuestionRow> = {}): DbOnlyQuestionRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  key: "admin.abc",
  subject: "physics",
  syllabusTopicId: "vectors",
  prompt: "Prompt",
  content: { type: "single_choice", choices: ["a", "b"] },
  answerKey: { type: "single_choice", correctChoiceIndex: 0 },
  explanation: "Because",
  difficulty: "basic",
  status: "reviewed",
  archived: false,
  ...patch,
});

describe("planDbExport", () => {
  it("gives each question the next free key for its topic and difficulty", () => {
    const plan = planDbExport(
      [row({ id: "b" }), row({ id: "a" })],
      new Set(["physics.vectors.basic.1"]),
    );
    expect(plan.exports.map((e) => [e.rowId, e.question.key])).toEqual([
      ["a", "physics.vectors.basic.2"],
      ["b", "physics.vectors.basic.3"],
    ]);
  });

  it("keeps status, archived state and the correct answer", () => {
    const [only] = planDbExport([row({ status: "draft", archived: true, answerKey: { type: "single_choice", correctChoiceIndex: 1 } })], new Set()).exports;
    expect(only?.question).toMatchObject({ status: "draft", archived: true, correctChoiceIndex: 1, explanation: "Because" });
  });

  it("numbers different topics and difficulties independently", () => {
    const plan = planDbExport(
      [row({ id: "a" }), row({ id: "b", difficulty: "advanced" }), row({ id: "c", syllabusTopicId: "kinematics" })],
      new Set(),
    );
    expect(plan.exports.map((e) => e.question.key).sort()).toEqual([
      "physics.kinematics.basic.1",
      "physics.vectors.advanced.1",
      "physics.vectors.basic.1",
    ]);
  });

  it("skips a row whose topic has no syllabus id, or whose answer key is malformed", () => {
    const plan = planDbExport(
      [row({ id: "a", syllabusTopicId: null }), row({ id: "b", answerKey: { type: "single_choice", correctChoiceIndex: 5 } })],
      new Set(),
    );
    expect(plan.exports).toEqual([]);
    expect(plan.skipped.map((s) => s.rowId)).toEqual(["a", "b"]);
  });

  it("exports a database-only single-choice row as a legacy file (no questionType, no invented author)", () => {
    const [only] = planDbExport([row()], new Set()).exports;
    expect(only?.question).toMatchObject({ questionType: "single_choice", legacy: true });
    expect(only?.question.author).toBeUndefined();
  });

  it("exports every other type from its content and answer key", () => {
    const plan = planDbExport(
      [
        row({
          id: "a",
          content: { type: "true_false_set", statements: ["x", "y", "z"] },
          answerKey: { type: "true_false_set", truthValues: [true, false, true] },
        }),
        row({
          id: "b",
          content: { type: "numeric_response", unit: "au" },
          answerKey: { type: "numeric_response", value: 2.35, tolerance: 0.01 },
        }),
      ],
      new Set(),
    );
    expect(plan.exports.map((e) => e.question)).toMatchObject([
      { questionType: "true_false_set", statements: [{ text: "x", isTrue: true }, { text: "y", isTrue: false }, { text: "z", isTrue: true }] },
      { questionType: "numeric_response", numericAnswer: { value: 2.35, tolerance: 0.01, unit: "au" } },
    ]);
  });
});
