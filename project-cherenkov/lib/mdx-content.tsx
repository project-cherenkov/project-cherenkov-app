"use client";

import { useMemo, type ComponentType } from "react";
import * as runtime from "react/jsx-runtime";

// Velite compiles each editorial's MDX `body` to a JS module source string,
// not a component — this is the small runtime Velite's own docs point
// projects to for turning that string back into something renderable.
function useMDXComponent(
  code: string,
): ComponentType<{ components?: Record<string, ComponentType<any>> }> {
  return useMemo(() => {
    const fn = new Function(code);
    return fn({ ...runtime }).default;
  }, [code]);
}

export function MDXContent({
  code,
  components,
}: {
  code: string;
  components?: Record<string, ComponentType<any>>;
}) {
  const Component = useMDXComponent(code);
  return <Component components={components} />;
}
