import * as React from "react";

import { cn } from "@/lib/utils";

// Shared text-field look. Before this existed, form controls were styled three
// different ways (auth: a raw slate border; scene builder: border-border
// bg-transparent; planner: a local `field` constant). One primitive means the
// next palette change is a token edit, and every field has the same 44px
// target and the same visible border (the control border token is 4.4:1 on the
// page, above the 3:1 WCAG 1.4.11 asks of UI boundaries).
export const controlClasses =
  "min-h-11 w-full rounded-md border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(controlClasses, className)} {...props} />
  ),
);
Input.displayName = "Input";

export { Input };
