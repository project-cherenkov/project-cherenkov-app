// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { submitQuizAttempt } = vi.hoisted(() => ({ submitQuizAttempt: vi.fn() }));
vi.mock("@/lib/quiz-actions", () => ({ submitQuizAttempt }));

// Same render-test convention as MD-001's
// components/viz/graph-array-stepper/index.test.tsx and the rest of this
// repo's component tests: renderToStaticMarkup + string assertions, with
// next-intl mocked to an identity translator.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(",")})` : key,
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// QuizDialog's own <Dialog> doesn't force itself open, and Radix's
// Dialog.Content is wrapped in Portal+Presence — closed by default, it
// renders nothing at all into renderToStaticMarkup's output, regardless of
// any prop passed from outside. What MD-002 actually changed is the
// prompt/choice markup *inside* DialogContent/Tabs, not the open/close
// mechanics themselves, so those wrappers are mocked here to always render
// their children — the same "mock what's in the way of the thing under
// test" approach components/site/not-found.test.tsx already uses for
// @/i18n/routing's Link.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { QuizDialog } from "./quiz-dialog";
import type { PublicQuizQuestion } from "@/lib/quiz";

describe("QuizDialog — prompt/choice rendering (MD-002)", () => {
  it("renders Markdown bold and KaTeX math in the prompt and a choice, not literal markup", () => {
    const questions: PublicQuizQuestion[] = [
      {
        id: "q1",
        prompt: "What is **O(log n)** for $n = 8$?",
        content: { type: "single_choice", choices: ["$3$", "4", "5", "6"] },
      },
    ];
    const html = renderToStaticMarkup(
      <QuizDialog topicId="topic-1" questions={questions} />,
    );

    expect(html).toContain("<strong>O(log n)</strong>");
    expect(html).toContain("katex");
  });

  it("renders a plain-text prompt/choices (no Markdown/math) exactly as their text content, matching today's behavior", () => {
    const questions: PublicQuizQuestion[] = [
      {
        id: "q1",
        prompt: "Plain question, no formatting.",
        content: { type: "single_choice", choices: ["Option A", "Option B"] },
      },
    ];
    const html = renderToStaticMarkup(
      <QuizDialog topicId="topic-1" questions={questions} />,
    );

    expect(html).toContain("Plain question, no formatting.");
    expect(html).toContain("Option A");
    expect(html).toContain("Option B");
  });

  it("still renders nothing for an empty question list, unaffected by the rendering change", () => {
    const html = renderToStaticMarkup(<QuizDialog topicId="topic-1" questions={[]} />);
    expect(html).toBe("");
  });
});

// ---- the four types -----------------------------------------------------------

const MIXED: PublicQuizQuestion[] = [
  { id: "s1", prompt: "Single?", content: { type: "single_choice", choices: ["A1", "A2", "A3"] } },
  { id: "m1", prompt: "Multi?", content: { type: "multiple_select", choices: ["M1", "M2", "M3", "M4"] } },
  { id: "t1", prompt: "TF?", content: { type: "true_false_set", statements: ["Stmt one", "Stmt two", "Stmt three"] } },
  { id: "n1", prompt: "Num?", content: { type: "numeric_response", unit: "au" } },
];

describe("QuizDialog — markup per question type", () => {
  const html = renderToStaticMarkup(<QuizDialog topicId="topic-1" questions={MIXED} />);
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");

  it("single choice renders radios in one group", () => {
    const radios = Array.from(doc.querySelectorAll("input[type=radio]")).filter((r) => /-choice$/.test(r.getAttribute("name") ?? ""));
    expect(radios).toHaveLength(3);
    expect(new Set(radios.map((r) => r.getAttribute("name"))).size).toBe(1);
  });

  it("multiple select renders checkboxes, one per option", () => {
    expect(doc.querySelectorAll("input[type=checkbox]")).toHaveLength(4);
    expect(html).toContain("instructionMultiple");
  });

  it("true/false renders a separate True/False radio pair per statement, each in its own labelled fieldset", () => {
    const sets = Array.from(doc.querySelectorAll("fieldset")).filter((f) => f.textContent?.includes("Stmt"));
    expect(sets).toHaveLength(3);
    const names = new Set<string>();
    for (const set of sets) {
      const radios = set.querySelectorAll("input[type=radio]");
      expect(radios).toHaveLength(2);
      names.add(radios[0]!.getAttribute("name")!);
      expect(radios[1]!.getAttribute("name")).toBe(radios[0]!.getAttribute("name"));
      expect(set.querySelector("legend")?.textContent).toMatch(/Stmt/);
    }
    expect(names.size).toBe(3);
  });

  it("numeric response renders a labelled text input with the unit shown and described", () => {
    const input = doc.querySelector("input[inputmode=decimal]") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(doc.querySelector(`label[for="${input.id}"]`)?.textContent).toContain("au");
    expect(doc.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toContain("au");
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("starts every question unanswered and renders no answer or feedback", () => {
    expect(html).not.toContain("tabCorrect");
    expect(html).not.toContain("tabIncorrect");
    expect(html).not.toContain("correctAnswerMark");
    expect(html).not.toContain("statementCorrect");
  });
});

describe("QuizDialog — submitting each type", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    submitQuizAttempt.mockReset();
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
  const type = (input: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  const submitButton = () => Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "submit")!;

  it("keeps submit disabled until something is validly answered", async () => {
    act(() => root.render(<QuizDialog topicId="topic-1" questions={MIXED} />));
    expect(submitButton().disabled).toBe(true);
    // An incomplete true/false answer and unparseable numeric text are not answers.
    await click(container.querySelectorAll("fieldset")[2]!.querySelector("input[type=radio]")!);
    await type(container.querySelector("input[inputmode=decimal]") as HTMLInputElement, "abc");
    expect(submitButton().disabled).toBe(true);
    expect(container.querySelector("[role=alert]")?.textContent).toBe("numericInvalid");
  });

  it("submits a typed response per type, and no response for incomplete questions", async () => {
    submitQuizAttempt.mockResolvedValue({ ok: false, reason: "no_valid_answers" });
    act(() => root.render(<QuizDialog topicId="topic-1" questions={MIXED} />));
    const radios = (name: RegExp) =>
      Array.from(container.querySelectorAll("input")).filter((i) => name.test(i.getAttribute("name") ?? ""));

    await click(radios(/-choice$/).filter((r) => (r as HTMLInputElement).type === "radio")[1]!); // A2
    const boxes = Array.from(container.querySelectorAll("input[type=checkbox]"));
    await click(boxes[3]!);
    await click(boxes[0]!);
    await click(boxes[3]!); // untick again -> only M1
    await click(boxes[2]!);
    // True/false: mark only two of three statements -> unanswered.
    const statementRadios = radios(/-statement-\d$/);
    await click(statementRadios[0]!); // statement 0 True
    await click(statementRadios[3]!); // statement 1 False
    await type(container.querySelector("input[inputmode=decimal]") as HTMLInputElement, "2,35");

    await click(submitButton());
    expect(submitQuizAttempt).toHaveBeenCalledTimes(1);
    expect(submitQuizAttempt.mock.calls[0]![0]).toEqual({
      topicId: "topic-1",
      answers: [
        { questionId: "s1", response: { type: "single_choice", choiceIndex: 1 } },
        { questionId: "m1", response: { type: "multiple_select", choiceIndices: [0, 2] } },
        { questionId: "n1", response: { type: "numeric_response", value: 2.35 } },
      ],
    });
  });

  it("submits a completed true/false vector in statement order", async () => {
    submitQuizAttempt.mockResolvedValue({ ok: false, reason: "no_valid_answers" });
    act(() => root.render(<QuizDialog topicId="topic-1" questions={[MIXED[2]!]} />));
    const r = Array.from(container.querySelectorAll("input[type=radio]"));
    await click(r[1]!); // s0 False
    await click(r[2]!); // s1 True
    await click(r[5]!); // s2 False
    await click(submitButton());
    expect(submitQuizAttempt.mock.calls[0]![0].answers).toEqual([
      { questionId: "t1", response: { type: "true_false_set", values: [false, true, false] } },
    ]);
  });

  it("after grading shows item-level feedback, the correct answer and the explanation per type, and locks the inputs", async () => {
    submitQuizAttempt.mockResolvedValue({
      ok: true,
      score: 0.5,
      results: [
        { questionId: "m1", correct: false, correctAnswer: { type: "multiple_select", correctChoiceIndices: [0, 2] }, explanation: "Because M." },
        { questionId: "t1", correct: false, correctAnswer: { type: "true_false_set", truthValues: [true, false, true] }, explanation: null },
        { questionId: "n1", correct: true, correctAnswer: { type: "numeric_response", value: 2.35, tolerance: 0.01, unit: "au" }, explanation: null },
      ],
    });
    act(() => root.render(<QuizDialog topicId="topic-1" questions={MIXED.slice(1)} />));
    await click(container.querySelectorAll("input[type=checkbox]")[1]!);
    const tf = Array.from(container.querySelectorAll("input[type=radio]"));
    await click(tf[1]!); // s0 False (wrong: it is true)
    await click(tf[3]!); // s1 False
    await click(tf[4]!); // s2 True
    await type(container.querySelector("input[inputmode=decimal]") as HTMLInputElement, "2.35");
    await click(submitButton());

    const text = container.textContent ?? "";
    expect(text).toContain("correctAnswerMark"); // multiple select marks the right options
    expect(text).toContain("Because M.");
    expect(text).toContain("statementIncorrect");
    expect(text).toContain("statementTrueIs");
    expect(text).toContain("statementFalseIs");
    expect(text).toContain("correctAnswerIs(numericAccepted(2.35,0.01,au))");
    expect(container.querySelector("input[type=checkbox]")).toHaveProperty("disabled", true);
    expect(container.querySelector("input[inputmode=decimal]")).toHaveProperty("disabled", true);
  });
});
