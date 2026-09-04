import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Matches the established render-test convention in this repo
// (components/site/theme-toggle.test.tsx, components/site/not-found.test.tsx,
// components/planner/plan-overview.test.tsx): renderToStaticMarkup + string
// assertions, with next-intl mocked to an identity translator since there's
// no NextIntlClientProvider in a bare unit-test render.
import { vi } from "vitest";
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { GraphArrayStepper } from "./index";
import type { GraphArrayStepperConfig } from "./types";

function configWithNote(note: string): GraphArrayStepperConfig {
  return {
    array: [2, 4, 6, 8],
    steps: [{ pointers: { i: 0 }, highlight: [0], note }],
  };
}

describe("GraphArrayStepper — step note rendering (MD-001)", () => {
  it("renders Markdown bold and KaTeX math in the step note, not literal markup", () => {
    const html = renderToStaticMarkup(
      <GraphArrayStepper config={configWithNote("**bold** and $O(\\log n)$")} />,
    );

    // Bold: react-markdown emits a real <strong>, not literal "**bold**".
    expect(html).toContain("<strong>bold</strong>");
    // Math: rehype-katex emits KaTeX's own markup, not the literal "$...$".
    // (The literal "**bold**"/"$O(\log n)$" text is still expected to
    // appear once, verbatim, in the <svg>'s own aria-label — that's
    // step?.note used directly for accessibility, correctly left as plain
    // text since an aria-label can't contain markup.)
    expect(html).toContain("katex");
  });

  it("renders a plain-text note (no Markdown/math) exactly as its text content, matching today's behavior", () => {
    const html = renderToStaticMarkup(
      <GraphArrayStepper config={configWithNote("Plain explanation, no formatting.")} />,
    );
    expect(html).toContain("Plain explanation, no formatting.");
  });

  it("renders no note element at all when the step has none", () => {
    const config: GraphArrayStepperConfig = {
      array: [1, 2, 3],
      steps: [{ pointers: {} }],
    };
    // Should not throw, and should not render a leftover empty note wrapper.
    expect(() => renderToStaticMarkup(<GraphArrayStepper config={config} />)).not.toThrow();
  });
});
