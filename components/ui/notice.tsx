import * as React from "react";

import { cn } from "@/lib/utils";

// One notice recipe in place of the pink-dashed (viz, docs), amber
// (companion), red/emerald (auth, planner) and pink-panel variants. The tone
// sets the edge and fill from the status tokens; the text stays
// `text-foreground` so it keeps its contrast in both themes.
const tones = {
  info: "border-border-strong bg-muted",
  danger: "border-danger-border bg-danger-bg",
  success: "border-success-border bg-success-bg",
  warning: "border-warning-border bg-warning-bg",
} as const;

export type NoticeProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: keyof typeof tones;
};

// `role` is the caller's call: "alert" for errors that appear after an action,
// "status" for polite updates, none for static notes.
export function Notice({ tone = "info", className, ...props }: NoticeProps) {
  return (
    <div className={cn("rounded-md border p-3 text-sm text-foreground", tones[tone], className)} {...props} />
  );
}
