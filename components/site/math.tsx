import katex from "katex";

interface MathProps {
  children: string;
  display?: boolean;
  className?: string;
}

// For math rendered from TSX (e.g. a formula label next to a viz slider)
// rather than from editorial MDX prose, which uses $...$ / $$...$$ syntax
// instead (see velite.config.ts — remark-math/rehype-katex). Both paths
// share the same KaTeX CSS, imported per-editorial-page, never globally.
export function Math({ children, display = false, className }: MathProps) {
  const html = katex.renderToString(children, {
    displayMode: display,
    throwOnError: false,
    output: "html",
  });

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
