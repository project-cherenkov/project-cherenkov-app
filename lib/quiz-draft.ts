// The student's in-progress answer to one question, before it is submitted.
// Pure (no React, no server code) so the rules about what counts as answered
// are unit-tested. Shared by the quiz dialog and the misses-review card.
import {
  parseNumericInput,
  type QuestionContent,
  type SubmittedResponse,
} from "./quiz-types";

export type AnswerDraft =
  | { type: "single_choice"; choiceIndex: number | null }
  | { type: "multiple_select"; choiceIndices: number[] }
  // One slot per statement; null = not marked yet.
  | { type: "true_false_set"; values: (boolean | null)[] }
  // Raw text, so "2," or "1e" can be typed on the way to a number.
  | { type: "numeric_response"; text: string };

export function emptyDraft(content: QuestionContent): AnswerDraft {
  switch (content.type) {
    case "single_choice":
      return { type: "single_choice", choiceIndex: null };
    case "multiple_select":
      return { type: "multiple_select", choiceIndices: [] };
    case "true_false_set":
      return { type: "true_false_set", values: content.statements.map(() => null) };
    case "numeric_response":
      return { type: "numeric_response", text: "" };
  }
}

// The response to submit, or null while the draft is not a complete, valid
// answer. A true/false question is answered only when EVERY statement is
// marked; a numeric one only when the text is a finite number.
export function draftToResponse(draft: AnswerDraft): SubmittedResponse | null {
  switch (draft.type) {
    case "single_choice":
      return draft.choiceIndex === null
        ? null
        : { type: "single_choice", choiceIndex: draft.choiceIndex };
    case "multiple_select":
      return draft.choiceIndices.length === 0
        ? null
        : {
            type: "multiple_select",
            choiceIndices: [...draft.choiceIndices].sort((a, b) => a - b),
          };
    case "true_false_set":
      return draft.values.every((v) => v !== null)
        ? { type: "true_false_set", values: draft.values as boolean[] }
        : null;
    case "numeric_response": {
      const value = parseNumericInput(draft.text);
      return value === null ? null : { type: "numeric_response", value };
    }
  }
}

export type DraftProgress = "unanswered" | "partial" | "answered";

// "partial" = something entered but not yet a submittable answer (some
// statements unmarked, or numeric text that is not a number).
export function draftProgress(draft: AnswerDraft): DraftProgress {
  if (draftToResponse(draft) !== null) return "answered";
  switch (draft.type) {
    case "true_false_set":
      return draft.values.some((v) => v !== null) ? "partial" : "unanswered";
    case "numeric_response":
      return draft.text.trim() === "" ? "unanswered" : "partial";
    default:
      return "unanswered";
  }
}

// Toggles one option of a multiple-select draft; never produces duplicates.
export function toggleChoice(indices: number[], index: number): number[] {
  return indices.includes(index)
    ? indices.filter((i) => i !== index)
    : [...indices, index].sort((a, b) => a - b);
}

// Turns a stored response back into an editable draft (used to show "your
// earlier answer"). Mismatched shapes yield an empty draft.
export function responseToDraft(
  content: QuestionContent,
  response: SubmittedResponse | null,
): AnswerDraft {
  if (response && response.type === content.type) {
    switch (response.type) {
      case "single_choice":
        return { type: "single_choice", choiceIndex: response.choiceIndex };
      case "multiple_select":
        return { type: "multiple_select", choiceIndices: [...response.choiceIndices] };
      case "true_false_set":
        return { type: "true_false_set", values: [...response.values] };
      case "numeric_response":
        return { type: "numeric_response", text: String(response.value) };
    }
  }
  return emptyDraft(content);
}
