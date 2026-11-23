import { describe, expect, it } from "vitest";
import { parseQuizArchivePatch, quizQuestionSource } from "./quiz-admin";

describe("parseQuizArchivePatch", () => {
  it("accepts an archive state", () => {
    expect(parseQuizArchivePatch({ archived: true })).toEqual({ ok: true, value: { archived: true } });
    expect(parseQuizArchivePatch({ archived: false })).toEqual({ ok: true, value: { archived: false } });
  });

  it("ignores every other field, so content cannot be changed through this endpoint", () => {
    const parsed = parseQuizArchivePatch({ archived: true, prompt: "x", correctChoiceIndex: 3, status: "reviewed" });
    expect(parsed).toEqual({ ok: true, value: { archived: true } });
  });

  it("rejects a missing or non-boolean archive state and non-objects", () => {
    for (const bad of [{}, { archived: "yes" }, { archived: 1 }, null, [], "x"]) {
      expect(parseQuizArchivePatch(bad).ok).toBe(false);
    }
  });
});

describe("quizQuestionSource", () => {
  it("reports git for keyed questions and database for admin.* or keyless rows", () => {
    expect(quizQuestionSource("physics.vectors.basic.1")).toBe("git");
    expect(quizQuestionSource("admin.0b9f")).toBe("database");
    expect(quizQuestionSource(null)).toBe("database");
  });
});
