// The hanging nav ribbon, drawn as SVG instead of public/navbar-banner-extended.png.
//
// Traced from that image at its native 285x300: a pennant with straight sides
// and a V-shaped foot, an edge, a thin inset line set ~13px inside it (open at
// the top), and a four-point sparkle by the tip. A pixel diff of the original
// shape against the PNG at 285x300 differs by about 0.24%.
//
// preserveAspectRatio="none" reproduces `object-fill`: the artwork stretches to
// the link box (96x112 on desktop, 64x72 for the Menu button), as the PNG did.
//
// Colour comes from CSS variables, not from this file. The parent link or
// button carries the `nav-ribbon` class, which sets the variables per theme
// and per state (rest, hover or focus, current page); see "Nav ribbons" in
// app/globals.css and docs/design/colour.md. Nothing here is a hex value, so
// changing the look never means editing the artwork.
//
// Strokes use `vector-effect: non-scaling-stroke`: the artwork is stretched to
// about a third of its size, so a width in viewBox units would shrink with it
// and could not be chosen in screen pixels. The widths are in pixels.
//
// The focus ring is drawn on the pennant's own outline (the parent link must
// carry the `group` class), so it follows the shape instead of the link box.
export function NavRibbonArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 285 300"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={["absolute inset-0 h-full w-full overflow-visible", className].filter(Boolean).join(" ")}
    >
      <path d="M1.82 0H284.2V218.3L143 300.4L1.82 218.3Z" style={{ fill: "var(--ribbon-fill)" }} />
      <path
        d="M1.82 0V218.3L143 300.4L284.2 218.3V0"
        fill="none"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ stroke: "var(--ribbon-edge)", strokeWidth: "var(--ribbon-edge-width)" }}
      />
      <path
        d="M13.85 0V211.1L143 286.2L272.15 211.1V0"
        fill="none"
        vectorEffect="non-scaling-stroke"
        style={{ stroke: "var(--ribbon-inset)", strokeWidth: 1 }}
      />
      <path
        d="M1.82 0V218.3L143 300.4L284.2 218.3V0"
        fill="none"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ strokeWidth: 3 }}
        className="stroke-[hsl(var(--ring))] opacity-0 group-focus-visible:opacity-100"
      />
      <path
        d="M143.75 264Q144.59 270.16 150.75 271Q144.59 271.84 143.75 278Q142.91 271.84 136.75 271Q142.91 270.16 143.75 264Z"
        style={{ fill: "var(--ribbon-sparkle)" }}
      />
    </svg>
  );
}
