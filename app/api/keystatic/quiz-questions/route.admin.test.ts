import { describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  rows: [] as unknown[],
  columns: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/auth-guard", () => ({ getCurrentUser: async () => ({ id: "admin", email: "a@example.com" }) }));
vi.mock("@/lib/admin-guard", () => ({ isVerifiedAdmin: () => true }));
vi.mock("@/lib/db", () => ({
  db: {
    select: (columns: Record<string, unknown>) => {
      const isQuestionQuery = "answerKey" in columns;
      if (isQuestionQuery) fixture.columns = columns;
      const builder: Record<string, unknown> = {
        from: () => builder,
        innerJoin: () => builder,
        orderBy: () => Promise.resolve(isQuestionQuery ? fixture.rows : []),
      };
      return builder;
    },
  },
}));

import { GET } from "./route";
import { quizQuestions } from "@/lib/db/schema";

describe("admin quiz-bank list handles every question type", () => {
  it("selects type, content and answer key (not the deprecated single-choice columns) and returns all four types", async () => {
    fixture.rows = [
      { id: "1", key: "physics.vectors.basic.1", questionType: "single_choice", content: { type: "single_choice", choices: ["a", "b"] }, answerKey: { type: "single_choice", correctChoiceIndex: 1 } },
      { id: "2", key: "physics.vectors.basic.2", questionType: "multiple_select", content: { type: "multiple_select", choices: ["a", "b", "c"] }, answerKey: { type: "multiple_select", correctChoiceIndices: [0, 2] } },
      { id: "3", key: "physics.vectors.basic.3", questionType: "true_false_set", content: { type: "true_false_set", statements: ["x", "y", "z"] }, answerKey: { type: "true_false_set", truthValues: [true, false, true] } },
      { id: "4", key: "admin.abc", questionType: "numeric_response", content: { type: "numeric_response", unit: "au" }, answerKey: { type: "numeric_response", value: 2.35, tolerance: 0.01 } },
    ];
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.questions.map((q: { questionType: string }) => q.questionType)).toEqual([
      "single_choice", "multiple_select", "true_false_set", "numeric_response",
    ]);
    const selected = Object.values(fixture.columns ?? {});
    expect(selected).toContain(quizQuestions.answerKey);
    expect(selected).not.toContain(quizQuestions.correctChoiceIndex);
    expect(selected).not.toContain(quizQuestions.choices);
  });
});
