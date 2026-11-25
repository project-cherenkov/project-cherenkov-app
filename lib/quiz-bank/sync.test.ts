import { describe, expect, it } from "vitest";
import { planQuizSync, type ExistingQuizRow, type QuizTopicRow } from "./sync";
import type { BankQuestion } from "./types";
import { MULTIPLE, NUMERIC, SINGLE, TRUE_FALSE } from "./test-fixtures";

const topicRows: QuizTopicRow[] = [
  { id: "t-vectors", subject: "physics", syllabusTopicId: "vectors" },
  { id: "t-search", subject: "informatics", syllabusTopicId: "binary-search" },
  { id: "t-legacy", subject: "physics", syllabusTopicId: null },
];

const q = (patch: Partial<BankQuestion> = {}): BankQuestion => ({
  key: "physics.vectors.basic.1",
  subject: "physics",
  topicId: "vectors",
  difficulty: "basic",
  prompt: "Prompt",
  questionType: "single_choice",
  choices: ["a", "b"],
  correctChoiceIndex: 1,
  explanation: "Because",
  status: "draft",
  archived: false,
  ...patch,
} as BankQuestion);

const row = (patch: Partial<ExistingQuizRow> = {}): ExistingQuizRow => ({
  id: "row-1",
  key: "physics.vectors.basic.1",
  topicId: "t-vectors",
  prompt: "Prompt",
  questionType: "single_choice",
  content: { type: "single_choice", choices: ["a", "b"] },
  answerKey: { type: "single_choice", correctChoiceIndex: 1 },
  explanation: "Because",
  difficulty: "basic",
  status: "draft",
  archived: false,
  ...patch,
});

describe("planQuizSync", () => {
  it("inserts a question that has no row yet", () => {
    const plan = planQuizSync([q()], [], topicRows);
    expect(plan.inserts).toEqual([
      {
        key: "physics.vectors.basic.1", topicId: "t-vectors", prompt: "Prompt",
        questionType: "single_choice", content: { type: "single_choice", choices: ["a", "b"] },
        answerKey: { type: "single_choice", correctChoiceIndex: 1 }, explanation: "Because", difficulty: "basic", status: "draft", archived: false,
      },
    ]);
    expect(plan.updates).toEqual([]);
  });

  it("does nothing when the database already matches the file", () => {
    const plan = planQuizSync([q()], [row()], topicRows);
    expect(plan).toMatchObject({ inserts: [], updates: [], archiveMissing: [], unchanged: 1 });
  });

  it("git wins: changed content overwrites the database row, keeping its id", () => {
    const plan = planQuizSync(
      [q({ prompt: "New prompt", choices: ["a", "b", "c"], correctChoiceIndex: 2, status: "reviewed", difficulty: "basic" })],
      [row({ prompt: "Edited in the database" })],
      topicRows,
    );
    expect(plan.updates).toEqual([
      { id: "row-1", key: "physics.vectors.basic.1", set: { prompt: "New prompt", content: { type: "single_choice", choices: ["a", "b", "c"] }, answerKey: { type: "single_choice", correctChoiceIndex: 2 }, status: "reviewed" } },
    ]);
  });

  it("treats a null explanation like an empty one only when the file is empty too", () => {
    expect(planQuizSync([q({ explanation: "" })], [row({ explanation: null })], topicRows).unchanged).toBe(1);
    expect(planQuizSync([q({ explanation: "Because" })], [row({ explanation: null })], topicRows).updates).toHaveLength(1);
  });

  it("archives a question the file marks archived", () => {
    const plan = planQuizSync([q({ archived: true })], [row()], topicRows);
    expect(plan.updates[0]?.set).toEqual({ archived: true });
  });

  it("never restores a question that is archived in the database", () => {
    const plan = planQuizSync([q({ archived: false })], [row({ archived: true })], topicRows);
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toBe(1);
    expect(plan.databaseOnlyArchived).toEqual(["physics.vectors.basic.1"]);
  });

  it("archives, never deletes, a git-managed row whose file is gone", () => {
    const plan = planQuizSync([q()], [row(), row({ id: "row-2", key: "physics.vectors.basic.2" })], topicRows);
    expect(plan.archiveMissing).toEqual([{ id: "row-2", key: "physics.vectors.basic.2" }]);
  });

  it("does not re-archive a missing row that is already archived", () => {
    const plan = planQuizSync([q()], [row(), row({ id: "row-2", key: "physics.vectors.basic.2", archived: true })], topicRows);
    expect(plan.archiveMissing).toEqual([]);
  });

  it("leaves admin.* and keyless rows completely alone", () => {
    const plan = planQuizSync(
      [q()],
      [row(), row({ id: "a", key: "admin.1234" }), row({ id: "b", key: null })],
      topicRows,
    );
    expect(plan.unmanaged).toBe(2);
    expect(plan.archiveMissing).toEqual([]);
    expect(plan.updates).toEqual([]);
  });

  it("skips a question whose syllabus topic has no topics row", () => {
    const plan = planQuizSync([q({ topicId: "kinematics", key: "physics.kinematics.basic.1" })], [], topicRows);
    expect(plan.skippedNoTopic).toEqual(["physics.kinematics.basic.1"]);
    expect(plan.inserts).toEqual([]);
  });

  it("matches topic rows by subject as well as topic id", () => {
    const plan = planQuizSync([q({ subject: "informatics", topicId: "binary-search", key: "informatics.binary-search.basic.1" })], [], topicRows);
    expect(plan.inserts[0]?.topicId).toBe("t-search");
  });

  it("archives nothing when the bank is empty", () => {
    expect(planQuizSync([], [row()], topicRows).archiveMissing).toEqual([]);
  });

  it("inserts every question type with its content and server-only answer key", () => {
    const rows = [SINGLE, MULTIPLE, TRUE_FALSE, NUMERIC];
    const plan = planQuizSync(rows, [], topicRows);
    expect(plan.inserts.map((i) => [i.questionType, i.content, i.answerKey])).toEqual([
      ["single_choice", { type: "single_choice", choices: ["a", "b", "c"] }, { type: "single_choice", correctChoiceIndex: 2 }],
      ["multiple_select", { type: "multiple_select", choices: ["a", "b", "c", "d", "e"] }, { type: "multiple_select", correctChoiceIndices: [0, 2] }],
      ["true_false_set", { type: "true_false_set", statements: ["s1", "s2", "s3", "s4"] }, { type: "true_false_set", truthValues: [true, false, true, false] }],
      ["numeric_response", { type: "numeric_response", unit: "au" }, { type: "numeric_response", value: 2.35, tolerance: 0.01 }],
    ]);
  });

  it("is a no-op when the stored jsonb matches but its key order differs (Postgres reorders keys)", () => {
    const existing = row({
      key: NUMERIC.key,
      questionType: "numeric_response",
      content: { unit: "au", type: "numeric_response" },
      answerKey: { tolerance: 0.01, value: 2.35, type: "numeric_response" },
    });
    const plan = planQuizSync([NUMERIC], [existing], topicRows);
    expect(plan).toMatchObject({ inserts: [], updates: [], unchanged: 1 });
  });

  it("updates the answer key when only the tolerance changed, keeping the row id", () => {
    const existing = row({
      key: NUMERIC.key,
      questionType: "numeric_response",
      content: { type: "numeric_response", unit: "au" },
      answerKey: { type: "numeric_response", value: 2.35, tolerance: 0.5 },
    });
    const plan = planQuizSync([NUMERIC], [existing], topicRows);
    expect(plan.updates).toEqual([
      { id: "row-1", key: NUMERIC.key, set: { answerKey: { type: "numeric_response", value: 2.35, tolerance: 0.01 } } },
    ]);
  });

  it("updates the type, content and key together when a question changes type", () => {
    const existing = row({ key: TRUE_FALSE.key });
    const plan = planQuizSync([TRUE_FALSE], [existing], topicRows);
    expect(Object.keys(plan.updates[0]!.set).sort()).toEqual(["answerKey", "content", "questionType"]);
  });
});
