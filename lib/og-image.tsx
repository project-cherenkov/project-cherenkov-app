import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

import { OG_SIZE, ogCard, type OgCardProps } from "@/lib/og-card";

export { OG_SIZE };
export type { OgCardProps };

// Shared 1200×630 social card, rendered by next/og (Satori) at build time, so
// there is no binary asset to maintain and nothing runs per request. The
// layout and artwork live in lib/og-card.tsx; this file only loads the fonts
// and hands the result to ImageResponse.
//
// Fonts: Space Grotesk (the site's heading face) and Space Mono (its
// code-label voice), both SIL OFL, bundled as WOFF in assets/og-fonts/.
// Satori reads TTF/OTF/WOFF but not WOFF2, which is why they are not taken
// from next/font. Only the Latin subset is shipped, which covers English and
// Indonesian.
const FONT_DIR = path.join(process.cwd(), "assets", "og-fonts");

const FONT_FILES = [
  { name: "Space Grotesk", file: "space-grotesk-latin-500-normal.woff", weight: 500 },
  { name: "Space Grotesk", file: "space-grotesk-latin-700-normal.woff", weight: 700 },
  { name: "Space Mono", file: "space-mono-latin-400-normal.woff", weight: 400 },
  { name: "Space Mono", file: "space-mono-latin-700-normal.woff", weight: 700 },
] as const;

let fontsPromise: ReturnType<typeof loadFonts> | undefined;

async function loadFonts() {
  return Promise.all(
    FONT_FILES.map(async ({ name, file, weight }) => {
      const buffer = await readFile(path.join(FONT_DIR, file));
      const data = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      return { name, data, weight, style: "normal" as const };
    }),
  );
}

export async function renderOgImage(props: OgCardProps) {
  fontsPromise ??= loadFonts();
  return new ImageResponse(ogCard(props), { ...OG_SIZE, fonts: await fontsPromise });
}
