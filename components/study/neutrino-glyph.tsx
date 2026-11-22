"use client";

export type GlyphKind = "question" | "dots" | "alert";

// 5 columns by 7 rows. "1" is a lit cell. Drawn as SVG rectangles, not from a
// font, so the shapes are exact at any pixel density.
const GRIDS: Record<Exclude<GlyphKind, "dots">, string[]> = {
  question: ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  alert: ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
};
const CELL = 4; // two base units

/**
 * A small pixel punctuation mark beside the mascot, pixel style only:
 * `?` when the AI chat is open and idle, three animated dots while a request
 * is pending, `!` for an error or limit. It sits on the corner opposite the
 * hide button and is decorative (`aria-hidden`); the panel's status text
 * carries the meaning. Under reduced motion the dots are static.
 */
export function NeutrinoGlyph({ kind }: { kind: GlyphKind }) {
  return (
    <span aria-hidden="true" data-glyph={kind} className="nt-glyph pointer-events-none absolute -left-3 -top-3 z-10 flex items-center justify-center bg-background p-1 text-foreground">
      {kind === "dots" ? (
        <svg width={CELL * 7} height={CELL * 3} viewBox="0 0 7 3" shapeRendering="crispEdges" fill="currentColor">
          <rect className="nt-dot nt-dot-1" x="0" y="0" width="1" height="1" />
          <rect className="nt-dot nt-dot-2" x="3" y="0" width="1" height="1" />
          <rect className="nt-dot nt-dot-3" x="6" y="0" width="1" height="1" />
        </svg>
      ) : (
        <svg width={CELL * 5} height={CELL * 7} viewBox="0 0 5 7" shapeRendering="crispEdges" fill="currentColor">
          {GRIDS[kind].flatMap((row, y) =>
            [...row].map((cell, x) => (cell === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)),
          )}
        </svg>
      )}
    </span>
  );
}
