"use client";

import { useMemo, type ComponentType } from "react";
import * as runtime from "react/jsx-runtime";

import { VizEngine } from "@/components/viz/viz-engine";

// Velite compiles each editorial's MDX `body` to a JS module source string,
// not a component — this is the small runtime Velite's own docs point
// projects to for turning that string back into something renderable.
function useMDXComponent(
  code: string,
): ComponentType<{ components?: Record<string, ComponentType<Record<string, unknown>>> }> {
  return useMemo(() => {
    const fn = new Function(code);
    return fn({ ...runtime }).default;
  }, [code]);
}

// The `Interactive` component must be defined on the client side because
// React's Server/Client boundary forbids passing functions as props from
// a Server Component to a Client Component. By building the components
// map here — inside a "use client" module — we avoid that constraint.
export function EditorialMDX({
  code,
  vizEngine,
  vizConfig,
}: {
  code: string;
  vizEngine: string;
  vizConfig: Record<string, unknown>;
}) {
  const Component = useMDXComponent(code);
  return (
    <Component
      components={{
        Interactive: () => (
          <div className="not-prose my-8">
            <VizEngine editorial={{ vizEngine, vizConfig }} />
          </div>
        ),
      }}
    />
  );
}
