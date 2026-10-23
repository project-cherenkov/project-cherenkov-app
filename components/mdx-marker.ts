import { isValidElement, type ReactNode } from "react";

// Walks the React element tree a compiled MDX body produces, looking for an
// element whose `type` is exactly `marker` (e.g. the `Interactive` or
// `Solution` component passed in via `components`). Shared by the editorial
// and material renderers so "was the tag actually used?" has one definition.
// (It replaced a search of the compiled source text for the word
// "Interactive", which also matched ordinary prose — finding F-05.)
export function usesMarker(node: ReactNode, marker: unknown): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (Array.isArray(node)) return node.some((child) => usesMarker(child, marker));
  if (!isValidElement(node)) return false;
  if (node.type === marker) return true;
  const children = (node.props as { children?: ReactNode } | null)?.children;
  return usesMarker(children ?? null, marker);
}
