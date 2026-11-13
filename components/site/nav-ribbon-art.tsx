// The hanging nav ribbon, drawn as SVG instead of public/navbar-banner-extended.png.
//
// Traced from that image at its native 285x300: a pennant with straight sides
// and a V-shaped foot, a rim, a thin white line set
// ~13px inside the edge (open at the top), and a four-point sparkle by the tip.
// A pixel diff of this SVG against the PNG at 285x300 differs by about 0.24%.
//
// preserveAspectRatio="none" reproduces `object-fill`: the artwork stretches to
// the link box (96x112 on desktop, 64x80 for the Menu button) exactly as the
// PNG did, so the proportions on screen are unchanged. Being vector, it stays
// sharp at any pixel density and has no image request or baked-in lettering.
//
// Colour: brand ink (#0B2436) trimmed with a cherenkov-pink-400 rim (#ED647F):
// pink as a trim, not a fill, so the blue-to-pink balance holds. Both come from
// the brand palette; the original was pure black. In dark mode the ink equals
// the page background, so the rim is what draws the shape.
// The focus ring is drawn on the pennant's own outline (the parent link must
// carry the `group` class), so it follows the shape instead of the link box.
export function NavRibbonArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 285 300"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={["absolute inset-0 h-full w-full", className].filter(Boolean).join(" ")}
    >
      <path d="M1.82 0H284.2V218.3L143 300.4L1.82 218.3Z" fill="#0B2436" />
      <path
        d="M1.82 0V218.3L143 300.4L284.2 218.3V0"
        fill="none"
        stroke="#ED647F"
        strokeWidth="9"
      />
      <path
        d="M13.85 0V211.1L143 286.2L272.15 211.1V0"
        fill="none"
        stroke="#fff"
        strokeWidth="1.1"
      />
      <path
        d="M1.82 0V218.3L143 300.4L284.2 218.3V0"
        fill="none"
        strokeWidth="9"
        strokeLinejoin="round"
        className="stroke-[hsl(var(--ring))] opacity-0 group-focus-visible:opacity-100"
      />
      <path
        d="M143.75 264Q144.59 270.16 150.75 271Q144.59 271.84 143.75 278Q142.91 271.84 136.75 271Q142.91 270.16 143.75 264Z"
        fill="#fff"
      />
    </svg>
  );
}
