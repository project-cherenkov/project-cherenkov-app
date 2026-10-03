"use client";

import { useMDXComponent } from "@/components/use-mdx-component";

// Renders a material's compiled MDX body. Materials are prose + math only —
// no <Interactive /> marker, no viz fallback — which is exactly why this is
// not EditorialMDX.
export function MaterialMDX({ code }: { code: string }) {
  const Component = useMDXComponent(code);
  return <Component />;
}
