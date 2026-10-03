"use client";

import { useMemo, type ComponentType, type ReactNode } from "react";
import * as runtime from "react/jsx-runtime";

// Velite compiles each MDX `body` to a JS module source string, not a
// component — this is the small runtime Velite's own docs point projects to
// for turning that string back into something renderable.
//
// Lives in its own module (extracted from editorial-mdx.tsx) so pages that
// only need prose — materials — can use it without importing the
// visualization engines that editorial-mdx.tsx pulls in.
export function useMDXComponent(
  code: string,
): (props: {
  components?: Record<string, ComponentType<Record<string, unknown>>>;
}) => ReactNode {
  return useMemo(() => {
    const fn = new Function(code);
    return fn({ ...runtime }).default;
  }, [code]);
}
