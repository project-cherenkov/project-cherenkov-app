import { Space_Grotesk, Inter, Pixelify_Sans } from "next/font/google";

// Shared by both root layouts (app/[locale]/layout.tsx and
// app/keystatic/layout.tsx). Next's font loaders have to be called at module
// scope, but nothing says that has to be inside a layout file — pulling them
// out here lets each root layout stay a few lines instead of duplicating the
// font setup. Same two families as before; nothing about typography changed.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

// A pixel display face for short, large text only (eyebrows, the home credo,
// page titles, Neutrino's interface chrome). Never paragraphs: see
// docs/design/visual-identity.md. `adjustFontFallback` keeps layout shift low
// while it loads; the stack in tailwind.config.ts is the real fallback.
const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

export const fontVariableClasses = `${spaceGrotesk.variable} ${inter.variable} ${pixelifySans.variable}`;
