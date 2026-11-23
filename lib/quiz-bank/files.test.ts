import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { nextFreeKey, parseQuizFile, quizFilePath, serializeQuizFile } from "./files";
import { loadQuizBank } from "./load";
import type { BankQuestion } from "./types";

const base: BankQuestion = {
  key: "physics.vectors.basic.1",
  subject: "physics",
  topicId: "vectors",
  difficulty: "basic",
  prompt: "Prompt",
  choices: ["a", "b", "c"],
  correctChoiceIndex: 2,
  explanation: "Because",
  status: "draft",
  archived: false,
};

// The nasty strings a real question can contain: YAML-looking scalars, quotes,
// backslashes, math, unicode, multi-line text, leading/trailing spaces.
const awkward: BankQuestion[] = [
  { ...base, key: "physics.vectors.basic.2", prompt: "Line one\nLine two\n\nAfter a blank line", explanation: "Uses $x^2$ and \\frac{1}{2}" },
  { ...base, key: "physics.vectors.basic.3", prompt: "  leading space", choices: ["true", "null", "1.5", "#hash", "a: b", "- dash"], correctChoiceIndex: 0 },
  { ...base, key: "physics.vectors.basic.4", prompt: "trailing  \nspace on a line", explanation: "say \"hi\" and 'bye'", archived: true, status: "reviewed" },
  { ...base, key: "physics.vectors.basic.5", prompt: "Unicode: √(3² + 4²) = 5 — ok", choices: ["α", "β"], correctChoiceIndex: 1, author: "Someone", source: "Adapted from a past paper" },
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
