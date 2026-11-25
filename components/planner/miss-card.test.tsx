// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { retryMissedQuestion, revealMissedAnswer } = vi.hoisted(() => ({
  retryMissedQuestion: vi.fn(),
  revealMissedAnswer: vi.fn(),
}));
vi.mock("@/lib/misses-actions", () => ({ retryMissedQuestion, revealMissedAnswer }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(",")})` : key,
  useLocale: () => "en",
}));
vi.mock("@/i18n/routing", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import { MissCard, type MissCardData } from "./miss-card";

const card = (over: Partial<MissCardData>): MissCardData => ({
  questionId: "q1",
  prompt: "Prompt",
  content: { type: "single_choice", choices: ["A", "B"] },
  difficulty: "basic",
  topicLabel: "Physics",
  resolved: false,
  wrongCount: 1,
  retryCount: 0,
  lastWrongResponse: null,
  materialHref: null,
  editorials: [],
  ...over,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  retryMissedQuestion.mockReset();
  revealMissedAnswer.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
const buttonByText = (text: string) => Array.from(container.querySelectorAll("button")).find((b) => b.textContent === text)!;

describe("MissCard — every question type", () => {
  it("shows the earlier answer of a multiple-select miss and retries with a typed response", async () => {
    retryMissedQuestion.mockResolvedValue({
      ok: true, correct: false, correctAnswer: { type: "multiple_select", correctChoiceIndices: [0, 1] }, explanation: "Why",
    });
    act(() =>
      root.render(
        <MissCard
          data={card({
            content: { type: "multiple_select", choices: ["A", "B", "C"] },
            lastWrongResponse: { type: "multiple_select", choiceIndices: [2] },
          })}
        />,
      ),
    );
    expect(container.textContent).toContain("(yourEarlierAnswer)");
    expect(container.textContent).not.toContain("correctAnswerMark"); // key not shown before retry/reveal
    expect(buttonByText("check").disabled).toBe(true);
    await click(container.querySelectorAll("input[type=checkbox]")[2]!);
    await click(container.querySelectorAll("input[type=checkbox]")[0]!);
    await click(buttonByText("check"));
    expect(retryMissedQuestion).toHaveBeenCalledWith({
      questionId: "q1",
      response: { type: "multiple_select", choiceIndices: [0, 2] },
    });
    expect(container.textContent).toContain("correctAnswerMark");
    expect(container.textContent).toContain("Why");
  });

  it("shows the earlier true/false marks and the correct vector after a reveal, recording nothing", async () => {
    revealMissedAnswer.mockResolvedValue({
      ok: true, correctAnswer: { type: "true_false_set", truthValues: [true, false, true] }, explanation: null,
    });
    act(() =>
      root.render(
        <MissCard
          data={card({
            content: { type: "true_false_set", statements: ["x", "y", "z"] },
            lastWrongResponse: { type: "true_false_set", values: [false, false, true] },
          })}
        />,
      ),
    );
    expect(container.textContent).toContain("yourEarlierAnswer: falseLabel");
    await click(buttonByText("showAnswer"));
    expect(revealMissedAnswer).toHaveBeenCalledWith("q1");
    expect(retryMissedQuestion).not.toHaveBeenCalled();
    expect(container.textContent).toContain("statementIncorrect");
    expect(container.textContent).toContain("statementTrueIs");
  });

  it("shows the earlier numeric answer with its unit and retries a numeric response", async () => {
    retryMissedQuestion.mockResolvedValue({
      ok: true, correct: true, correctAnswer: { type: "numeric_response", value: 2.35, tolerance: 0.01, unit: "au" }, explanation: null,
    });
    act(() =>
      root.render(
        <MissCard
          data={card({
            content: { type: "numeric_response", unit: "au" },
            lastWrongResponse: { type: "numeric_response", value: 9.9 },
          })}
        />,
      ),
    );
    expect(container.textContent).toContain("yourEarlierAnswer: 9.9 au");
    const input = container.querySelector("input[inputmode=decimal]") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2,35");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(buttonByText("check"));
    expect(retryMissedQuestion).toHaveBeenCalledWith({ questionId: "q1", response: { type: "numeric_response", value: 2.35 } });
    expect(container.textContent).toContain("retryCorrect");
  });

  it("still shows a legacy single-choice earlier answer", () => {
    act(() => root.render(<MissCard data={card({ lastWrongResponse: { type: "single_choice", choiceIndex: 1 } })} />));
    expect(container.textContent).toContain("B(yourEarlierAnswer)");
  });

  it("ignores an earlier answer whose type no longer matches the question (question was re-typed)", () => {
    act(() => root.render(<MissCard data={card({ lastWrongResponse: { type: "numeric_response", value: 1 } })} />));
    expect(container.textContent).not.toContain("yourEarlierAnswer");
  });
});
