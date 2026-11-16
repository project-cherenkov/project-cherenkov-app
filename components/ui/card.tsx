import * as React from "react";

import { cn } from "@/lib/utils";

// The "rounded-lg border border-border bg-card" recipe was written out by hand
// in 26 places. Radius rule: controls are `rounded-md`, cards and panels are
// `rounded-lg`, chips are `rounded-full`. The edge is the soft `border-border`
// on purpose: a card edge is decoration, not a UI boundary (WCAG 1.4.11 does
// not ask for 3:1 there), unlike a form control (see `Input`).
export const cardClasses = "rounded-lg border border-border bg-card";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(cardClasses, "p-5", className)} {...props} />,
);
Card.displayName = "Card";
