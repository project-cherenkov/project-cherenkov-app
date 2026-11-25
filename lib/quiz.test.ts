import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  rows: [] as unknown[],
  selectedColumns: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: (columns: Record<string, unknown>) => {
      fixture.selectedColumns = columns;
      const builder = {
        from: () => builder,
        where: () => Promise.resolve(fixture.rows),
      };
      return builder;
    },
  },
}));

import { getQuizQuestionsForTopic } from "./quiz";
import { quizQuestions } from "./db/schema";

beforeEach(() => {
  fixture.selectedColumns = null;
  fixture.rows = [
    { id: "s", prompt: "P1", content: { type: "single_choice", choices: ["a", "b"] } },
    { id: "m", prompt: "P2", content: { type: "multiple_select", choices: ["a", "b", "c"] } },
    { id: "t", prompt: "P3", content: { type: "true_false_set", statements: ["x", "y", "z"] } },
    { id: "n", prompt: "P4", content: { type: "numeric_response", unit: "au" } },
    { id: "bad", prompt: "P5", content: { type: "essay" } },
  ];
});

describe("public quiz question read (answer-key privacy)", () => {
  it("never selects the answer-key column or the deprecated correct-index column", async () => {
    await getQuizQuestionsForTopic("topic-1");
    expect(Object.values(fixture.selectedColumns ?? {})).not.toContain(quizQuestions.answerKey);
    expect(Object.values(fixture.selectedColumns ?? {})).not.toContain(quizQuestions.correctChoiceIndex);
    expect(Object.keys(fixture.selectedColumns ?? {}).sort()).toEqual(["content", "id", "prompt"]);
  });

  it("returns only the type, prompt and display content for each of the four types, skipping corrupt rows", async () => {
    const questions = await getQuizQuestionsForTopic("topic-1");
    expect(questions.map((q) => q.id)).toEqual(["s", "m", "t", "n"]);
    expect(questions.map((q) => q.content.type)).toEqual(["single_choice", "multiple_select", "true_false_set", "numeric_response"]);
    const json = JSON.stringify(questions);
    for (const secret of ["correct", "isTrue", "truthValues", "tolerance", "answerKey", "value"]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it("even a row that wrongly carried key fields in its content would expose nothing extra", async () => {
    fixture.rows = [{ id: "n", prompt: "P", content: { type: "numeric_response", unit: "au", value: 2.35, tolerance: 0.01 } }];
    const [q] = await getQuizQuestionsForTopic("topic-1");
    expect(q?.content).toEqual({ type: "numeric_response", unit: "au" });
  });
});

// Static guard: the client-side quiz components and the public read module must
// never mention the server-only answer key.
describe("client quiz code does not touch answer-key material", () => {
  const root = join(__dirname, "..");
  const files = [
    join(root, "lib/quiz.ts"),
    ...readdirSync(join(root, "components/quiz"))
      .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
      .map((f) => join(root, "components/quiz", f)),
  ];
  it.each(files)("%s", (file) => {
    const code = readFileSync(file, "utf8").replace(/\/\/.*$/gm, "");
    // (RevealedAnswer fields such as truthValues are fine in components: they
    // only ever hold a value the server returned AFTER submission.)
    expect(code).not.toMatch(/answerKey|answer_key/);
    if (!file.endsWith("lib/quiz.ts")) expect(code).not.toMatch(/@\/lib\/db/);
  });
});
