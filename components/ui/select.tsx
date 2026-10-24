import * as React from "react";

import { cn } from "@/lib/utils";
import { controlClasses } from "@/components/ui/input";

// A native <select> on purpose: it is keyboard- and touch-friendly for free
// and the archive filters keep their state in the URL. Only the look is shared.
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(controlClasses, "pr-8", className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export { Select };
