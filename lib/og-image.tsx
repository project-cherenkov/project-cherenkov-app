import { ImageResponse } from "next/og";

// Shared 1200×630 social card. Rendered by next/og (Satori) at build time, so
// there is no binary asset to maintain and nothing runs per request. Uses only
// the built-in font — adding the site's own typefaces would mean bundling font
// files, which is a typography decision left to the project.
export const OG_SIZE = { width: 1200, height: 630 } as const;

export function renderOgImage({
  eyebrow,
  title,
  footer,
}: {
  eyebrow: string;
  title: string;
  footer: string;
}) {
  // Long editorial titles must still fit: step the size down by length.
  const titleSize = title.length > 90 ? 52 : title.length > 55 ? 64 : 80;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0b1620 0%, #12303f 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: "#8AD7FF" }} />
          <div style={{ fontSize: 34, letterSpacing: 1, color: "#8AD7FF" }}>{eyebrow}</div>
        </div>
        <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.12 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#cbd5e1" }}>{footer}</div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
