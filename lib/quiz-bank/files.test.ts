import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { nextFreeKey, parseQuizFile, quizFilePath, serializeQuizFile } from "./files";
import { loadQuizBank } from "./load";
import type { BankQuestion } from "./types";
import { ALL_TYPES, MULTIPLE, NUMERIC, SINGLE, TRUE_FALSE } from "./test-fixtures";

// A legacy question: no questionType line, no author or source.
const base: BankQuestion = {
  key: "physics.vectors.basic.1",
  subject: "physics",
  topicId: "vectors",
  difficulty: "basic",
  prompt: "Prompt",
  questionType: "single_choice",
  choices: ["a", "b", "c"],
  correctChoiceIndex: 2,
  explanation: "Because",
  status: "draft",
  archived: false,
  legacy: true,
};

// The nasty strings a real question can contain: YAML-looking scalars, quotes,
// backslashes, math, unicode, multi-line text, leading/trailing spaces.
const awkward: BankQuestion[] = [
  { ...base, key: "physics.vectors.basic.2", prompt: "Line one\nLine two\n\nAfter a blank line", explanation: "Uses $x^2$ and \\frac{1}{2}" },
  { ...base, key: "physics.vectors.basic.3", prompt: "  leading space", choices: ["true", "null", "1.5", "#hash", "a: b", "- dash"], correctChoiceIndex: 0 },
  { ...base, key: "physics.vectors.basic.4", prompt: "trailing  \nspace on a line", explanation: "say \"hi\" and 'bye'", archived: true, status: "reviewed" },
  { ...base, key: "physics.vectors.basic.5", prompt: "Unicode: √(3² + 4²) = 5 — ok", choices: ["α", "β"], correctChoiceIndex: 1, author: "Someone", source: "Adapted from a past paper", legacy: undefined },
  { ...base, key: "physics.vectors.basic.6", prompt: "ends with newline\n", explanation: "tab\there" },
];

const roots: string[] = [];
function tempRoot(questions: BankQuestion[]) {
  const root = mkdtempSync(join(tmpdir(), "quiz-"));
  roots.push(root);
  for (const q of questions) {
    const path = join(root, quizFilePath(q.subject, q.key));
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, serializeQuizFile(q));
  }
  return root;
}
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("serializeQuizFile -> Keystatic reader round trip", () => {
  it("reads back exactly what was written, including awkward strings", async () => {
    const written = [base, ...awkward];
    const { bank, problems } = await loadQuizBank(tempRoot(written));
    expect(problems).toEqual([]);
    const byKey = new Map(bank.map((q) => [q.key, q]));
    for (const q of written) expect(byKey.get(q.key), q.key).toEqual(q);
  });

  it("round-trips every question type through the real Keystatic reader without losing a field", async () => {
    const tricky: BankQuestion[] = [
      { ...MULTIPLE, key: "physics.vectors.basic.11", choices: ["true", "$x^2$", "a: b", "- dash", "multi\nline"], correctChoiceIndices: [1, 4] },
      { ...TRUE_FALSE, key: "physics.vectors.basic.12", statements: [{ text: "yes", isTrue: false }, { text: "no: 1.5", isTrue: true }, { text: "say \"hi\"", isTrue: true }, { text: "α", isTrue: false }, { text: "last", isTrue: false }] },
      { ...NUMERIC, key: "physics.vectors.basic.13", numericAnswer: { value: -1.5e-7, tolerance: 0, unit: "m/s$^2$" } },
      { ...NUMERIC, key: "physics.vectors.basic.14", numericAnswer: { value: 6.02e23, tolerance: 1e20, unit: "mol$^{-1}$" } },
      { ...NUMERIC, key: "physics.vectors.basic.15", numericAnswer: { value: 0, tolerance: 0.5, unit: "au" } },
    ];
    const written = [...ALL_TYPES, ...tricky];
    const { bank, problems } = await loadQuizBank(tempRoot(written));
    expect(problems).toEqual([]);
    const byKey = new Map(bank.map((q) => [q.key, q]));
    expect(bank).toHaveLength(written.length);
    for (const q of written) expect(byKey.get(q.key), q.key).toEqual(q);
  });

  it("reads a legacy file (no questionType) as single_choice and writes it back unchanged", async () => {
    const root = mkdtempSync(join(tmpdir(), "quiz-"));
    roots.push(root);
    const key = "physics.vectors.basic.1";
    const path = join(root, quizFilePath("physics", key));
    mkdirSync(join(path, ".."), { recursive: true });
    const legacyText = [
      `questionId: ${key}`, "topic: vectors", "difficulty: basic", "status: reviewed", "archived: false",
      'prompt: "P"', "choices:", '  - text: "a"', "    correct: false", '  - text: "b"', "    correct: true",
      'explanation: "E"', "",
    ].join("\n");
    writeFileSync(path, legacyText);
    const { bank, problems } = await loadQuizBank(root);
    expect(problems).toEqual([]);
    expect(bank[0]).toMatchObject({ questionType: "single_choice", correctChoiceIndex: 1, legacy: true });
    expect(serializeQuizFile(bank[0]!)).toBe(legacyText);
  });

  it("treats an explicit questionType: single_choice as new-format (author and source required)", async () => {
    const { bank } = await loadQuizBank(tempRoot([SINGLE]));
    expect(bank[0]!.legacy).toBeUndefined();
    expect(serializeQuizFile(SINGLE)).toContain("questionType: single_choice");
  });

  it("writes the contract's flat YAML layout for each new type", () => {
    expect(serializeQuizFile(NUMERIC)).toContain(
      'numericAnswer:\n  value: 2.35\n  tolerance: 0.01\n  unit: "au"\n',
    );
    expect(serializeQuizFile(TRUE_FALSE)).toContain('statements:\n  - text: "s1"\n    isTrue: true\n');
    expect(serializeQuizFile(MULTIPLE).match(/correct: true/g)).toHaveLength(2);
  });

  it("leaves optional fields out when empty and keeps the correct flag on one choice only", () => {
    const text = serializeQuizFile(base);
    expect(text).not.toMatch(/author|source/);
    expect(text.match(/correct: true/g)).toHaveLength(1);
  });
});

describe("parseQuizFile", () => {
  const data = {
    questionId: "physics.vectors.basic.1", topic: "vectors", difficulty: "basic", status: "draft", archived: false,
    prompt: "P", explanation: "E", choices: [{ text: "a", correct: false }, { text: "b", correct: true }],
  };

  it("defaults a missing questionType to single_choice and marks the question legacy", () => {
    const parsed = parseQuizFile("physics", "physics.vectors.basic.1", data);
    expect(parsed.question).toMatchObject({ questionType: "single_choice", legacy: true });
  });

  it("rejects an unknown questionType and fields that belong to another type", () => {
    const k = "physics.vectors.basic.1";
    expect(parseQuizFile("physics", k, { ...data, questionType: "essay" }).problems.join()).toContain("unknown questionType");
    const stray = parseQuizFile("physics", k, { ...data, questionType: "single_choice", statements: [{ text: "x", isTrue: true }] });
    expect(stray.problems.join()).toContain("must not have statements");
    const strayNumeric = parseQuizFile("physics", k, { ...data, questionType: "single_choice", numericAnswer: { value: 1, tolerance: 0, unit: "m" } });
    expect(strayNumeric.problems.join()).toContain("must not have numericAnswer");
    const strayChoices = parseQuizFile("physics", k, { ...data, questionType: "numeric_response", numericAnswer: { value: 1, tolerance: 0, unit: "m" } });
    expect(strayChoices.problems.join()).toContain("must not have choices");
  });

  it("treats the empty defaults Keystatic writes for unused groups as absent", () => {
    const parsed = parseQuizFile("physics", "physics.vectors.basic.1", {
      ...data, questionType: "single_choice", statements: [], numericAnswer: { value: null, tolerance: null, unit: "" },
    });
    expect(parsed.problems).toEqual([]);
    expect(parsed.question?.questionType).toBe("single_choice");
  });

  it("requires a numeric value and tolerance, and parses multiple_select indices", () => {
    const k = "physics.vectors.basic.1";
    const noNumbers = parseQuizFile("physics", k, { ...data, questionType: "numeric_response", choices: [], numericAnswer: { value: null, tolerance: 0.1, unit: "m" } });
    expect(noNumbers.question).toBeNull();
    const multi = parseQuizFile("physics", k, { ...data, questionType: "multiple_select", choices: [{ text: "a", correct: true }, { text: "b" }, { text: "c", correct: true }] });
    expect(multi.question).toMatchObject({ questionType: "multiple_select", correctChoiceIndices: [0, 2] });
  });

  it("builds a question from a well-formed entry", () => {
    const parsed = parseQuizFile("physics", "physics.vectors.basic.1", data);
    expect(parsed.problems).toEqual([]);
    expect(parsed.question).toMatchObject({ key: "physics.vectors.basic.1", correctChoiceIndex: 1, archived: false });
  });

  it.each([
    ["no correct choice", { choices: [{ text: "a" }, { text: "b" }] }, "exactly one choice"],
    ["two correct choices", { choices: [{ text: "a", correct: true }, { text: "b", correct: true }] }, "exactly one choice"],
    ["unknown difficulty", { difficulty: "hard" }, "difficulty"],
    ["unknown status", { status: "published" }, "status"],
    ["no topic", { topic: "" }, "no topic"],
  ])("rejects %s", (_name, patch, text) => {
    const parsed = parseQuizFile("physics", "physics.vectors.basic.1", { ...data, ...patch });
    expect(parsed.question).toBeNull();
    expect(parsed.problems.join("\n")).toContain(text);
  });

  it("reports a Question ID that disagrees with the file name", () => {
    const parsed = parseQuizFile("physics", "physics.vectors.basic.1", { ...data, questionId: "physics.vectors.basic.9" });
    expect(parsed.problems.join("\n")).toContain("does not match the file name");
  });
});

describe("nextFreeKey", () => {
  it("returns the smallest unused number", () => {
    const taken = new Set(["physics.vectors.basic.1", "physics.vectors.basic.2", "physics.vectors.basic.4"]);
    expect(nextFreeKey("physics", "vectors", "basic", taken)).toBe("physics.vectors.basic.3");
  });
});
