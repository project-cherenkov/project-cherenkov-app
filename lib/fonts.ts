import { Space_Grotesk, Inter } from "next/font/google";

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

export const fontVariableClasses = `${spaceGrotesk.variable} ${inter.variable}`;
