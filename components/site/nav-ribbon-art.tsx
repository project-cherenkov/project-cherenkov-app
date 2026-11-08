// The hanging nav ribbon, drawn as SVG instead of public/navbar-banner-extended.png.
//
// Traced from that image at its native 285x300: a near-black pennant with
// straight sides and a V-shaped foot, a faint grey rim, a thin white line set
// ~13px inside the edge (open at the top), and a four-point sparkle by the tip.
// A pixel diff of this SVG against the PNG at 285x300 differs by about 0.24%.
//
// preserveAspectRatio="none" reproduces `object-fill`: the artwork stretches to
// the link box (96x112 on desktop, 64x80 for the Menu button) exactly as the
// PNG did, so the proportions on screen are unchanged. Being vector, it stays
// sharp at any pixel density and has no image request or baked-in lettering.
export function NavRibbonArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 285 300"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={["absolute inset-0 h-full w-full", className].filter(Boolean).join(" ")}
    >
      <path d="M1.82 0H284.2V218.3L143 300.4L1.82 218.3Z" fill="#010001" />
      <path
        d="M1.82 0V218.3L143 300.4L284.2 218.3V0"
        fill="none"
        stroke="#322f31"
        strokeWidth="1.15"
      />
      <path
        d="M13.85 0V211.1L143 286.2L272.15 211.1V0"
        fill="none"
        stroke="#fff"
        strokeWidth="1.1"
      />
      <path
        d="M143.75 264Q144.59 270.16 150.75 271Q144.59 271.84 143.75 278Q142.91 271.84 136.75 271Q142.91 270.16 143.75 264Z"
        fill="#fff"
      />
    </svg>
  );
}
