import * as React from "react";

import { cn } from "@/lib/utils";

// One recipe for the tag pills, subject chips and status badges that were
// hand-built in at least five files.
//   tag      learner pink (the `chip` token: still pink in dark mode)
//   subject  quiet neutral surface with brand text
//   outline  a bordered badge, e.g. "Draft"
const variants = {
  tag: "rounded-full bg-chip px-2.5 py-0.5 text-xs text-chip-foreground",
  subject: "rounded bg-muted px-2 py-0.5 text-xs text-brand",
  outline: "rounded border border-border-strong px-2 py-0.5 text-xs text-foreground",
} as const;

export type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
};

export function chipClasses(variant: keyof typeof variants = "tag") {
  return variants[variant];
}

export function Chip({ variant = "tag", className, ...props }: ChipProps) {
  return <span className={cn("inline-block", variants[variant], className)} {...props} />;
}
