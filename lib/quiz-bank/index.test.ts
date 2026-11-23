import { beforeAll, describe, expect, it } from "vitest";
import { getPlannerTopicCount } from "../syllabus";
import { QUESTION_DIFFICULTIES } from "../planner-vocab";
import { getBankCoverage, validateQuizBank } from ".";
import { loadQuizBank } from "./load";
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
  archived: false,
};

describe("validateQuizBank", () => {
  it("accepts a well-formed question", () => {
    expect(validateQuizBank([GOOD])).toEqual([]);
  });

  it("flags each kind of defect", () => {
    const cases: [string, Partial<BankQuestion>][] = [
      ["no planner topic", { topicId: "not-a-topic", key: "physics.not-a-topic.basic.1" }],
      ["no planner topic", { subject: "astronomy", topicId: "sidereal-synodic-periods", key: "astronomy.sidereal-synodic-periods.basic.1" }],
      ["unknown difficulty", { difficulty: undefined as unknown as BankQuestion["difficulty"] }],
      ["correctChoiceIndex", { correctChoiceIndex: 2 }],
      ["correctChoiceIndex", { correctChoiceIndex: -1 }],
      ["duplicate choices", { choices: ["a", "a"] }],
      ["at least 2 choices", { choices: ["a"], correctChoiceIndex: 0 }],
      ["empty prompt", { prompt: " " }],
      ["empty explanation", { explanation: "" }],
      ["key does not match", { key: "physics.vectors.advanced.1" }],
      ["key is not of the form", { key: "physics.vectors.basic.one" }],
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

describe("the shipped quiz content (content/quiz)", () => {
  let QUIZ_BANK: BankQuestion[] = [];
  let loadProblems: string[] = [];
  beforeAll(async () => {
    const loaded = await loadQuizBank();
    QUIZ_BANK = loaded.bank;
    loadProblems = loaded.problems;
  });

  // This is the check that runs on every pull request: a question with no or
  // several correct choices, an ID that disagrees with its file name, or a key
  // that disagrees with its topic and difficulty fails CI before it can merge.
  it("has no problems", () => {
    expect(loadProblems).toEqual([]);
    expect(validateQuizBank(QUIZ_BANK)).toEqual([]);
  });

  it("is not empty", () => {
    expect(QUIZ_BANK.length).toBeGreaterThan(0);
  });

  it("labels every question with a difficulty and a status", () => {
    for (const q of QUIZ_BANK) {
      expect(QUESTION_DIFFICULTIES).toContain(q.difficulty);
      expect(["draft", "reviewed"]).toContain(q.status);
    }
  });

  it("covers every physics topic at every difficulty", () => {
    const physics = getBankCoverage(QUIZ_BANK).filter((row) => row.subject === "physics");
    expect(physics).toHaveLength(getPlannerTopicCount("physics"));
    for (const row of physics) {
      for (const d of QUESTION_DIFFICULTIES) {
        expect(row.counts[d], `${row.topicId} / ${d}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("does not hide topics without questions from the coverage report", () => {
    const all = getBankCoverage(QUIZ_BANK);
    const total = (["informatics", "physics", "astronomy"] as const).reduce(
      (n, s) => n + getPlannerTopicCount(s),
      0,
    );
    expect(all).toHaveLength(total);
    const empty = all.find((r) => r.subject === "informatics" && r.topicId === "language-syntax");
    expect(empty?.counts).toEqual({ basic: 0, intermediate: 0, advanced: 0 });
  });

  it("the coverage report lists only OSN-based topics, never an IPhO-only one", () => {
    const rows = getBankCoverage(QUIZ_BANK).filter((row) => row.subject === "physics");
    expect(rows.some((row) => row.topicId === "relativity")).toBe(false);
    expect(rows.some((row) => row.topicId === "kinematics")).toBe(true);
  });

  it("keeps the correct answer from always sitting in the same position", () => {
    const positions = new Set(QUIZ_BANK.map((q) => q.correctChoiceIndex));
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  it("does not count archived questions toward coverage", () => {
    const first = QUIZ_BANK.find((q) => q.subject === "physics")!;
    const before = getBankCoverage(QUIZ_BANK).find(
      (r) => r.subject === "physics" && r.topicId === first.topicId,
    )!;
    const after = getBankCoverage(
      QUIZ_BANK.map((q) => (q.key === first.key ? { ...q, archived: true } : q)),
    ).find((r) => r.subject === "physics" && r.topicId === first.topicId)!;
    expect(after.counts[first.difficulty]).toBe(before.counts[first.difficulty] - 1);
  });
});
