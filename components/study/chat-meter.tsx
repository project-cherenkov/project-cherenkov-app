"use client";

import type { CompanionStyle } from "@/lib/companion-settings";

/**
 * "7 of 15" as an accessible meter. The pixel style draws one cell per unit;
 * the smooth style draws a thin bar. The text is always there, so the figure
 * never depends on the drawing.
 */
export function ChatMeter({
  label,
  value,
  max,
  valueText,
  style,
}: {
  label: string;
  value: number;
  max: number;
  valueText: string;
  style: CompanionStyle;
}) {
  const clamped = Math.min(max, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={clamped} aria-valuetext={valueText} className="text-xs">
        <span className="tabular-nums text-muted-foreground">{valueText}</span>
        {style === "pixel" ? (
          <span aria-hidden="true" className="mt-1 flex flex-wrap gap-px">
            {Array.from({ length: max }, (_, index) => (
              <span key={index} className={`h-2 w-2 border border-border-strong ${index < clamped ? "bg-foreground" : "bg-transparent"}`} />
            ))}
          </span>
        ) : (
          <span aria-hidden="true" className="mt-1 block h-1 w-full overflow-hidden rounded bg-muted">
            <span className="block h-full bg-foreground" style={{ width: `${max === 0 ? 0 : (clamped / max) * 100}%` }} />
          </span>
        )}
      </div>
    </div>
  );
}
