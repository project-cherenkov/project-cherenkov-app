import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui-style class merger: lets components accept a
// `className` override without Tailwind class conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
