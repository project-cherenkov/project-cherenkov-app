import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Same render-test convention as MD-001's
// components/viz/graph-array-stepper/index.test.tsx and the rest of this
// repo's component tests: renderToStaticMarkup + string assertions, with
// next-intl mocked to an identity translator.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
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
        choices: ["$3$", "4", "5", "6"],
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
        choices: ["Option A", "Option B"],
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
