"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Shared by MD-001 (graph-array-stepper step notes), MD-002 (quiz
// prompt/choices), and composed-scene's own SceneStep.note (A-4) — one
// implementation so the three stay visually/behaviourally identical rather
// than drifting, per MD-002's own "reuse, not a second implementation"
// constraint.
//
// This renders client-side, at runtime — unlike the editorial body's own
// $...$/$$...$$ math, which velite.config.ts compiles to static KaTeX HTML
// at *build* time via the same remark-math/rehype-katex pair. The text
// here (step notes, quiz prompts/choices) comes from frontmatter/DB data
// Velite never sees as MDX, so it has no build-time compilation step to
// hook into; using the identical plugin pair here just means the same
// $...$/$$...$$ delimiter convention works in both places (MD-001's own
// requirement), not that the two pipelines are actually shared.
//
// Callers must still import "katex/dist/katex.min.css" somewhere in the
// page that renders this component — matching how
// app/[locale]/archive/[subject]/[slug]/page.tsx already imports it
// per-page rather than globally (spec's code-splitting rule). This
// component does not import that CSS itself, since components/quiz and
// components/viz/shared render on more than one route and a component-level
// CSS import would pull that stylesheet into pages with no math at all.
export function MarkdownText({
  text,
  className,
  inline = false,
}: {
  text: string;
  className?: string;
  /**
   * Renders the root wrapper as a <span> and collapses react-markdown's own
   * paragraph wrapping to <span> too, instead of the default <div>/<p>.
   * Needed for content that must legally sit inside another inline/phrasing
   * context — e.g. MD-002's quiz choice text inside a <label>, whose HTML
   * content model doesn't permit block-level (<div>/<p>) descendants.
   */
  inline?: boolean;
}) {
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={inline ? { p: "span" } : undefined}
      >
        {text}
      </ReactMarkdown>
    </Wrapper>
  );
}
