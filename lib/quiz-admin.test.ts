import { describe, expect, it } from "vitest";
import { parseQuizQuestionInput, parseQuizQuestionPatch } from "./quiz-admin";

const valid = {
  subject: "informatics", topicId: "topic-id", prompt: "What is 2 + 2?",
  choices: ["3", "4"], correctChoiceIndex: 1, explanation: "Add the two values.", difficulty: "basic",
};

describe("quiz question authoring validation", () => {
  it("accepts a valid multiple-choice question and trims values", () => {
    const parsed = parseQuizQuestionInput({ ...valid, prompt: "  What is 2 + 2?  ", choices: [" 3 ", "4 "] });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toMatchObject({ prompt: "What is 2 + 2?", choices: ["3", "4"] });
  });

  it.each([
    [{ ...valid, prompt: " " }, "Prompt is required."],
    [{ ...valid, choices: ["4"] }, "Add at least two answer choices."],
    [{ ...valid, choices: ["4", "  "] }, "Every answer choice must contain text."],
    [{ ...valid, choices: ["4", "4"] }, "Answer choices must be unique."],
    [{ ...valid, correctChoiceIndex: 2 }, "Select one of the answer choices as correct."],
    [{ ...valid, explanation: " " }, "Explanation is required."],
    [{ ...valid, difficulty: "expert" }, "Choose a valid difficulty."],
    [{ ...valid, subject: "biology" }, "Choose a valid subject."],
  ])("rejects invalid input with a useful error", (input, expected) => {
    expect(parseQuizQuestionInput(input)).toEqual({ ok: false, error: expected });
  });

  it("requires explicit valid review and archive state on edits", () => {
    expect(parseQuizQuestionPatch({ ...valid, status: "draft", archived: true })).toMatchObject({ ok: true, value: { status: "draft", archived: true } });
    expect(parseQuizQuestionPatch({ ...valid, status: "published", archived: false })).toMatchObject({ ok: false });
    expect(parseQuizQuestionPatch({ ...valid, status: "reviewed" })).toMatchObject({ ok: false });
  });
});
