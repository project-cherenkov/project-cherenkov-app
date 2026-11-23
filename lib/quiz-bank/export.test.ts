import { describe, expect, it } from "vitest";
import { planDbExport, type DbOnlyQuestionRow } from "./export";

const row = (patch: Partial<DbOnlyQuestionRow> = {}): DbOnlyQuestionRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  key: "admin.abc",
  subject: "physics",
  syllabusTopicId: "vectors",
  prompt: "Prompt",
  choices: ["a", "b"],
  correctChoiceIndex: 0,
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
    const [only] = planDbExport([row({ status: "draft", archived: true, correctChoiceIndex: 1 })], new Set()).exports;
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

  it("skips a row whose topic has no syllabus id, or whose answer index is invalid", () => {
    const plan = planDbExport(
      [row({ id: "a", syllabusTopicId: null }), row({ id: "b", correctChoiceIndex: 5 })],
      new Set(),
    );
    expect(plan.exports).toEqual([]);
    expect(plan.skipped.map((s) => s.rowId)).toEqual(["a", "b"]);
  });
});
