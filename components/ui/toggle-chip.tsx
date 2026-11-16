import * as React from "react";

import { cn } from "@/lib/utils";

// A pressable chip for "pick one of these" rows (timer block length, companion
// options, FAQ suggestions). It shares the boundary token with `Input`
// (`border-border-strong`, 4.4:1 on the page), so a chip row and the number
// fields beside it look like one family and clear the 3:1 asked of UI
// boundaries by WCAG 1.4.11. The softer `border-border` is 1.3:1 and is for
// decorative card edges only.
export const toggleChipClasses =
  "inline-flex min-h-10 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors";

export type ToggleChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

const ToggleChip = React.forwardRef<HTMLButtonElement, ToggleChipProps>(
  ({ className, selected = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        toggleChipClasses,
        selected
          ? "border-brand bg-brand text-background"
          : "border-border-strong bg-background text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
ToggleChip.displayName = "ToggleChip";

export { ToggleChip };
