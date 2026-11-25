"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MarkdownText } from "@/components/viz/shared/markdown-text";
import { toggleChoice, type AnswerDraft } from "@/lib/quiz-draft";
import type {
  QuestionContent,
  RevealedAnswer,
  SubmittedResponse,
} from "@/lib/quiz-types";
import { parseNumericInput } from "@/lib/quiz-types";

export interface QuestionInputProps {
  content: QuestionContent;
  draft: AnswerDraft;
  onChange: (draft: AnswerDraft) => void;
  disabled?: boolean;
  // Present only AFTER submission (or a permitted reveal): marks the right
  // answer. Before that the component has no way to know it.
  revealed?: RevealedAnswer | null;
  // What the student submitted, to mark "your answer" next to `revealed`.
  submitted?: SubmittedResponse | null;
  // Wording for that mark; defaults to "your answer". The miss review passes
  // "your earlier answer".
  submittedMark?: string;
}

// Plain number for display: no grouping, scientific notation only for very
// large or very small values, locale decimal mark.
function formatNumber(value: number, locale: string): string {
  const abs = Math.abs(value);
  if (value !== 0 && (abs >= 1e9 || abs < 1e-6)) return String(value);
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumSignificantDigits: 15 }).format(value);
}

const optionClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm hover:bg-muted has-[:checked]:border-border-strong has-[:checked]:bg-muted has-[:disabled]:cursor-default";

// The input for ONE question, by type: radios (single choice), checkboxes
// (multiple select), a True/False radio pair per statement, or a numeric field
// with its unit. Controlled by `draft`; the parent decides when a draft becomes
// a submittable response (lib/quiz-draft.ts). Status after grading is always
// spelled out in words, never colour alone.
export function QuestionInput({ content, draft, onChange, disabled, revealed, submitted, submittedMark }: QuestionInputProps) {
  const t = useTranslations("quiz");
  const locale = useLocale();
  const groupId = useId();
  const mark = submittedMark ?? t("yourAnswerMark");

  if (content.type === "single_choice" && draft.type === "single_choice") {
    const correct = revealed?.type === "single_choice" ? revealed.correctChoiceIndex : null;
    const mine = submitted?.type === "single_choice" ? submitted.choiceIndex : null;
    return (
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm text-muted-foreground">{t("instructionSingle")}</legend>
        <div className="flex flex-col gap-2">
          {content.choices.map((choice, index) => (
            <label key={index} className={optionClass}>
              <input
                className="h-4 w-4 shrink-0"
                type="radio"
                name={`${groupId}-choice`}
                checked={draft.choiceIndex === index}
                onChange={() => onChange({ type: "single_choice", choiceIndex: index })}
                disabled={disabled}
              />
              <span className="min-w-0">
                <MarkdownText text={choice} inline />
                {correct === index ? (
                  <span className="ml-2 font-medium text-success">({t("correctAnswerMark")})</span>
                ) : null}
                {mine === index ? (
                  <span className="ml-2 text-muted-foreground">({mark})</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (content.type === "multiple_select" && draft.type === "multiple_select") {
    const correct = revealed?.type === "multiple_select" ? revealed.correctChoiceIndices : null;
    const mine = submitted?.type === "multiple_select" ? submitted.choiceIndices : null;
    return (
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm text-muted-foreground">{t("instructionMultiple")}</legend>
        <div className="flex flex-col gap-2">
          {content.choices.map((choice, index) => (
            <label key={index} className={optionClass}>
              <input
                className="h-4 w-4 shrink-0"
                type="checkbox"
                name={`${groupId}-choice`}
                checked={draft.choiceIndices.includes(index)}
                onChange={() =>
                  onChange({ type: "multiple_select", choiceIndices: toggleChoice(draft.choiceIndices, index) })
                }
                disabled={disabled}
              />
              <span className="min-w-0">
                <MarkdownText text={choice} inline />
                {correct?.includes(index) ? (
                  <span className="ml-2 font-medium text-success">({t("correctAnswerMark")})</span>
                ) : null}
                {mine?.includes(index) ? (
                  <span className="ml-2 text-muted-foreground">({mark})</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (content.type === "true_false_set" && draft.type === "true_false_set") {
    const truth = revealed?.type === "true_false_set" ? revealed.truthValues : null;
    const mine = submitted?.type === "true_false_set" ? submitted.values : null;
    const word = (value: boolean) => (value ? t("trueLabel") : t("falseLabel"));
    return (
      <div className="min-w-0">
        <p className="mb-2 text-sm text-muted-foreground">{t("instructionTrueFalse")}</p>
        <ol className="flex flex-col gap-3">
          {content.statements.map((statement, index) => {
            const marked = draft.values[index] ?? null;
            const right = truth ? truth[index] : null;
            const given = mine ? mine[index] : null;
            return (
              <li key={index}>
                {/* Each statement is its own radio group, so the True/False
                    pair always announces which statement it answers. */}
                <fieldset className="rounded-md border border-border p-3">
                  <legend className="px-1 text-sm font-medium">
                    <span className="sr-only">{t("statementLabel", { n: index + 1 })}: </span>
                    <span aria-hidden>{index + 1}. </span>
                    <MarkdownText text={statement} inline />
                  </legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {[true, false].map((value) => (
                      <label key={String(value)} className={optionClass}>
                        <input
                          className="h-4 w-4 shrink-0"
                          type="radio"
                          name={`${groupId}-statement-${index}`}
                          checked={marked === value}
                          onChange={() => {
                            const values = [...draft.values];
                            values[index] = value;
                            onChange({ type: "true_false_set", values });
                          }}
                          disabled={disabled}
                        />
                        {word(value)}
                      </label>
                    ))}
                  </div>
                  {right !== null ? (
                    <p className={`mt-1 text-sm ${given === right ? "text-success" : "text-danger"}`}>
                      {given === right ? t("statementCorrect") : t("statementIncorrect")}
                      {" — "}
                      {right ? t("statementTrueIs") : t("statementFalseIs")}
                      {given !== null && given !== undefined ? ` (${t("yourMark", { value: word(given) })})` : ""}
                    </p>
                  ) : given !== null && given !== undefined ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {mark}: {word(given)}
                    </p>
                  ) : null}
                </fieldset>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (content.type === "numeric_response" && draft.type === "numeric_response") {
    const invalid = draft.text.trim() !== "" && parseNumericInput(draft.text) === null;
    const inputId = `${groupId}-numeric`;
    const hintId = `${groupId}-hint`;
    const errorId = `${groupId}-error`;
    const key = revealed?.type === "numeric_response" ? revealed : null;
    return (
      <div className="min-w-0">
        <p id={hintId} className="mb-2 text-sm text-muted-foreground">
          {t("instructionNumeric", { unit: content.unit })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            {t("numericLabel", { unit: content.unit })}
          </label>
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 w-40 rounded-md border border-border-strong bg-background px-3 text-sm"
            value={draft.text}
            onChange={(event) => onChange({ type: "numeric_response", text: event.target.value })}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}
          />
          {/* The unit sits beside the input and is also in the hint and the
              label, so it is never only visual. */}
          <span className="text-sm font-medium" aria-hidden>
            <MarkdownText text={content.unit} inline />
          </span>
        </div>
        {invalid ? (
          <p id={errorId} role="alert" className="mt-1 text-sm text-danger">
            {t("numericInvalid")}
          </p>
        ) : null}
        {submitted?.type === "numeric_response" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {mark}: {formatNumber(submitted.value, locale)} {content.unit}
          </p>
        ) : null}
        {key ? (
          <p className="mt-2 text-sm font-medium text-success">
            {t("correctAnswerIs", {
              answer: t("numericAccepted", {
                value: formatNumber(key.value, locale),
                tolerance: formatNumber(key.tolerance, locale),
                unit: key.unit,
              }),
            })}
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}
