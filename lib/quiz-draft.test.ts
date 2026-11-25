import { describe, expect, it } from "vitest";
import { draftProgress, draftToResponse, emptyDraft, responseToDraft, toggleChoice } from "./quiz-draft";
import type { QuestionContent } from "./quiz-types";
import type { AnswerDraft } from "./quiz-draft";

const tf: QuestionContent = { type: "true_false_set", statements: ["a", "b", "c"] };
const num: QuestionContent = { type: "numeric_response", unit: "au" };
const multi: QuestionContent = { type: "multiple_select", choices: ["a", "b", "c"] };
const single: QuestionContent = { type: "single_choice", choices: ["a", "b"] };

describe("quiz drafts", () => {
  it("starts every type unanswered", () => {
    for (const content of [single, multi, tf, num]) {
      expect(draftProgress(emptyDraft(content))).toBe("unanswered");
      expect(draftToResponse(emptyDraft(content))).toBeNull();
    }
  });

  it("a true/false question counts as answered only when every statement is marked", () => {
    const partial: AnswerDraft = { type: "true_false_set", values: [true, null, false] };
    expect(draftToResponse(partial)).toBeNull();
    expect(draftProgress(partial)).toBe("partial");
    const full: AnswerDraft = { type: "true_false_set", values: [true, false, false] };
    expect(draftToResponse(full)).toEqual({ type: "true_false_set", values: [true, false, false] });
    expect(draftProgress(full)).toBe("answered");
  });

  it("a numeric question is answered only for a finite number (decimal comma accepted)", () => {
    expect(draftToResponse({ type: "numeric_response", text: "2,35" })).toEqual({ type: "numeric_response", value: 2.35 });
    expect(draftToResponse({ type: "numeric_response", text: "abc" })).toBeNull();
    expect(draftProgress({ type: "numeric_response", text: "abc" })).toBe("partial");
    expect(draftProgress({ type: "numeric_response", text: "  " })).toBe("unanswered");
  });

  it("toggling a multiple-select option never duplicates and keeps indices sorted", () => {
    expect(toggleChoice([], 2)).toEqual([2]);
    expect(toggleChoice([2], 0)).toEqual([0, 2]);
    expect(toggleChoice([0, 2], 2)).toEqual([0]);
    expect(draftToResponse({ type: "multiple_select", choiceIndices: [2, 0] })).toEqual({ type: "multiple_select", choiceIndices: [0, 2] });
  });

  it("turns a stored response back into a draft, ignoring a mismatched type", () => {
    expect(responseToDraft(multi, { type: "multiple_select", choiceIndices: [1] })).toEqual({ type: "multiple_select", choiceIndices: [1] });
    expect(responseToDraft(num, { type: "single_choice", choiceIndex: 0 })).toEqual({ type: "numeric_response", text: "" });
    expect(responseToDraft(single, null)).toEqual({ type: "single_choice", choiceIndex: null });
  });
});
