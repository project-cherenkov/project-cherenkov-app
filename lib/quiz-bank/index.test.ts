import { describe, expect, it } from "vitest";
import { getTopicCount } from "../syllabus";
import { QUESTION_DIFFICULTIES } from "../planner-vocab";
import { getBankCoverage, QUIZ_BANK, validateQuizBank } from ".";
import type { BankQuestion } from "./types";

const GOOD: BankQuestion = {
  key: "physics.vectors.basic.1",
  subject: "physics",
  topicId: "vectors",
  difficulty: "basic",
  prompt: "p",
  choices: ["a", "b"],
  correctChoiceIndex: 1,
  explanation: "e",
  status: "draft",
};

describe("validateQuizBank", () => {
  it("accepts a well-formed question", () => {
    expect(validateQuizBank([GOOD])).toEqual([]);
  });

  it("flags each kind of defect", () => {
    const cases: [string, Partial<BankQuestion>][] = [
      ["no syllabus topic", { topicId: "not-a-topic", key: "physics.not-a-topic.basic.1" }],
      ["unknown difficulty", { difficulty: undefined as unknown as BankQuestion["difficulty"] }],
      ["correctChoiceIndex", { correctChoiceIndex: 2 }],
      ["correctChoiceIndex", { correctChoiceIndex: -1 }],
      ["duplicate choices", { choices: ["a", "a"] }],
      ["at least 2 choices", { choices: ["a"], correctChoiceIndex: 0 }],
      ["empty prompt", { prompt: " " }],
      ["empty explanation", { explanation: "" }],
      ["key does not match", { key: "physics.vectors.advanced.1" }],
    ];
    for (const [expected, patch] of cases) {
      const problems = validateQuizBank([{ ...GOOD, ...patch }]);
      expect(problems.join("\n"), JSON.stringify(patch)).toContain(expected);
    }
  });

  it("flags duplicate keys", () => {
    expect(validateQuizBank([GOOD, GOOD]).join("\n")).toContain("duplicate key");
  });
});

describe("the shipped quiz bank", () => {
  it("has no problems", () => {
    expect(validateQuizBank(QUIZ_BANK)).toEqual([]);
  });

  it("labels every question with a difficulty and a status", () => {
    for (const q of QUIZ_BANK) {
      expect(QUESTION_DIFFICULTIES).toContain(q.difficulty);
      expect(["draft", "reviewed"]).toContain(q.status);
    }
  });

  it("covers every physics topic at every difficulty", () => {
    const physics = getBankCoverage().filter((row) => row.subject === "physics");
    expect(physics).toHaveLength(getTopicCount("physics"));
    for (const row of physics) {
      for (const d of QUESTION_DIFFICULTIES) {
        expect(row.counts[d], `${row.topicId} / ${d}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("does not hide topics without questions from the coverage report", () => {
    const all = getBankCoverage();
    const total = (["informatics", "physics", "astronomy"] as const).reduce(
      (n, s) => n + getTopicCount(s),
      0,
    );
    expect(all).toHaveLength(total);
    const empty = all.find((r) => r.subject === "informatics" && r.topicId === "language-syntax");
    expect(empty?.counts).toEqual({ basic: 0, intermediate: 0, advanced: 0 });
  });

  it("keeps the correct answer from always sitting in the same position", () => {
    const positions = new Set(QUIZ_BANK.map((q) => q.correctChoiceIndex));
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });
});
