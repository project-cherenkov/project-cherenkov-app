"use client";

import type { ComponentType, ReactNode } from "react";

import { Link } from "@/i18n/routing";
import { useMDXComponent } from "@/components/use-mdx-component";

// In-site links in doc MDX are written as plain "/docs/foo" — routed through
// next-intl's Link so they pick up the current locale prefix. Anything else
// (https://, mailto:, #anchors) is a normal anchor.
function DocLink({ href, children, ...rest }: { href?: string; children?: ReactNode }) {
  if (href && href.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

// Wide tables scroll inside their own box instead of pushing the page
// sideways (WCAG 1.4.10 reflow). tabIndex makes the box keyboard-scrollable.
function DocTable({ children }: { children?: ReactNode }) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-md border border-border" tabIndex={0}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold dark:[&_th]:bg-slate-800/60">
        {children}
      </table>
    </div>
  );
}

const components = {
  a: DocLink,
  table: DocTable,
} as unknown as Record<string, ComponentType<Record<string, unknown>>>;

export function DocMDX({ code }: { code: string }) {
  const Component = useMDXComponent(code);
  return <Component components={components} />;
}
