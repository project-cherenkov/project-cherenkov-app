import { beforeAll, describe, expect, it } from "vitest";
import { getPlannerTopicCount } from "../syllabus";
import { QUESTION_DIFFICULTIES } from "../planner-vocab";
import { getBankCoverage, validateQuizBank } from ".";
import { loadQuizBank } from "./load";
import type { BankQuestion } from "./types";
import { ALL_TYPES, MULTIPLE, NUMERIC, SINGLE, TRUE_FALSE } from "./test-fixtures";

const GOOD: BankQuestion = { ...SINGLE, choices: ["a", "b"], correctChoiceIndex: 1 };
const LEGACY_GOOD: BankQuestion = (() => {
  const { author, source, ...rest } = GOOD;
  void author;
  void source;
  return { ...rest, legacy: true } as BankQuestion;
})();

describe("validateQuizBank", () => {
  it("accepts a well-formed question", () => {
    expect(validateQuizBank([GOOD])).toEqual([]);
  });

  it("accepts a well-formed question of every type", () => {
    expect(validateQuizBank(ALL_TYPES)).toEqual([]);
  });

  it("flags each kind of defect", () => {
    const cases: [string, Record<string, unknown>][] = [
      ["no planner topic", { topicId: "not-a-topic", key: "physics.not-a-topic.basic.1" }],
      ["no planner topic", { subject: "astronomy", topicId: "sidereal-synodic-periods", key: "astronomy.sidereal-synodic-periods.basic.1" }],
      ["unknown difficulty", { difficulty: undefined as unknown as BankQuestion["difficulty"] }],
      ["exactly one choice", { correctChoiceIndex: 2 }],
      ["exactly one choice", { correctChoiceIndex: -1 }],
      ["duplicate choices", { choices: ["a", "a"] }],
      ["at least 2 choices", { choices: ["a"], correctChoiceIndex: 0 }],
      ["empty prompt", { prompt: " " }],
      ["empty explanation", { explanation: "" }],
      ["key does not match", { key: "physics.vectors.advanced.1" }],
      ["key is not of the form", { key: "physics.vectors.basic.one" }],
    ];
    for (const [expected, patch] of cases) {
      const problems = validateQuizBank([{ ...GOOD, ...patch } as BankQuestion]);
      expect(problems.join("\n"), JSON.stringify(patch)).toContain(expected);
    }
  });

  const flag = (q: BankQuestion) => validateQuizBank([q]).join("\n");

  it("enforces the multiple_select rules", () => {
    const m = (patch: Record<string, unknown>) => flag({ ...MULTIPLE, ...patch } as BankQuestion);
    expect(m({ choices: ["a", "b"], correctChoiceIndices: [0, 1] })).toContain("at least 3 choices");
    expect(m({ correctChoiceIndices: [0] })).toContain("at least two correct");
    expect(m({ correctChoiceIndices: [0, 1, 2, 3, 4] })).toContain("at least one incorrect");
    expect(m({ correctChoiceIndices: [0, 9] })).toContain("at least two correct");
    expect(m({ choices: ["a", "b", "c", "All of the above", "e"] })).toContain("all of the above");
    expect(m({ choices: ["a", "a", "c", "d", "e"] })).toContain("duplicate choices");
  });

  it("enforces the true_false_set rules", () => {
    const t = (statements: { text: string; isTrue: boolean }[]) =>
      flag({ ...TRUE_FALSE, statements } as BankQuestion);
    const st = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `s${i}`, isTrue: i % 2 === 0 }));
    expect(t(st(2))).toContain("3-5 statements");
    expect(t(st(6))).toContain("3-5 statements");
    expect(t(st(3))).toBe("");
    expect(t(st(5))).toBe("");
    expect(t([...st(3), { text: "s0", isTrue: true }])).toContain("duplicate statements");
    expect(t([...st(2), { text: " ", isTrue: true }])).toContain("empty statement");
  });

  it("enforces the numeric_response rules", () => {
    const n = (numericAnswer: Record<string, unknown>) =>
      flag({ ...NUMERIC, numericAnswer: { ...NUMERIC.numericAnswer, ...numericAnswer } } as BankQuestion);
    expect(n({ value: Number.NaN })).toContain("finite");
    expect(n({ value: Infinity })).toContain("finite");
    expect(n({ tolerance: -0.1 })).toContain("tolerance");
    expect(n({ tolerance: Number.NaN })).toContain("tolerance");
    expect(n({ tolerance: 0 })).toBe("");
    expect(n({ unit: "  " })).toContain("unit");
  });

  it("requires author and source on new-format questions but not on legacy ones", () => {
    expect(flag({ ...GOOD, author: undefined })).toContain("author is required");
    expect(flag({ ...GOOD, source: " " })).toContain("source is required");
    expect(flag(LEGACY_GOOD)).toBe("");
  });

  it("rejects an unknown question type", () => {
    expect(flag({ ...GOOD, questionType: "essay" } as unknown as BankQuestion)).toContain("unknown questionType");
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
    const positions = new Set(QUIZ_BANK.flatMap((q) => (q.questionType === "single_choice" ? [q.correctChoiceIndex] : [])));
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
