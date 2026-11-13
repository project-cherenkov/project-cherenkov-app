import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui-style class merger: lets components accept a
// `className` override without Tailwind class conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "confusing-sidereal-and-solar-days" -> "Confusing sidereal and solar days".
 * Principle and error-type values are kebab-case identifiers in the content
 * frontmatter; this is the reader-facing form.
 */
export function humanizeSlug(slug: string): string {
  const spaced = slug.replace(/[-_]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
