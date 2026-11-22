"use client";

import { Component, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Link } from "@/i18n/routing";
import { classifyHref, prepareChatMarkdown } from "@/lib/companion-markdown";
// Loaded here, not site-wide: this component is loaded only when the panel
// shows a chat. KaTeX's MathML output stays on for screen readers.
import "katex/dist/katex.min.css";

// Locked-down Markdown for chat text. No raw HTML (rehype-raw is not used, so
// tags are shown as text), no images (the alt text is shown instead, so a
// reply cannot make the browser fetch a third-party URL), restricted links, and
// no tables (without remark-gfm they stay plain text).
function Heading({ level, children }: { level: number; children?: ReactNode }) {
  // Chat headings must not enter the page outline: styled blocks at level 3+.
  return (
    <div role="heading" aria-level={Math.min(6, Math.max(3, level + 2))} className="mt-2 font-semibold">
      {children}
    </div>
  );
}

const components: Components = {
  h1: ({ children }) => <Heading level={1}>{children}</Heading>,
  h2: ({ children }) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }) => <Heading level={3}>{children}</Heading>,
  h4: ({ children }) => <Heading level={4}>{children}</Heading>,
  h5: ({ children }) => <Heading level={5}>{children}</Heading>,
  h6: ({ children }) => <Heading level={6}>{children}</Heading>,
  img: ({ alt }) => <span>{alt ?? ""}</span>,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-1.5 border-l-2 border-border-strong pl-3 text-muted-foreground">{children}</blockquote>,
  pre: ({ children }) => <pre className="my-1.5 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{children}</pre>,
  code: ({ children, className }) => <code className={className ?? "rounded bg-muted px-1 font-mono text-[0.85em]"}>{children}</code>,
  a: ({ href, children }) => {
    const target = classifyHref(href);
    if (target.kind === "internal") {
      return <Link href={target.href} className="underline underline-offset-2">{children}</Link>;
    }
    if (target.kind === "external") {
      return (
        <a href={target.href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
          {children}
        </a>
      );
    }
    return <span>{children}</span>;
  },
};

// A malformed reply must never take the panel down: if rendering throws, the
// raw text is shown instead.
class PlainFallback extends Component<{ text: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="whitespace-pre-wrap">{this.props.text}</p> : this.props.children;
  }
}

export default function NeutrinoMarkdown({ text }: { text: string }) {
  return (
    <PlainFallback text={text} key={text}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", errorColor: "currentColor" }]]}
        components={components}
        urlTransform={(url) => url}
      >
        {prepareChatMarkdown(text)}
      </ReactMarkdown>
    </PlainFallback>
  );
}
