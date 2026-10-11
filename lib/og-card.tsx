import type { ReactElement } from "react";

// The pure half of the social card: layout and artwork, with no dependency on
// next/og, so it can be rendered (and tested) anywhere Satori runs. The
// next/og wrapper, font loading and the 1200×630 contract live in
// lib/og-image.tsx.
//
// Colours are the brand tokens from tailwind.config.ts, repeated here because
// importing that file would pull the typography plugin into the route bundle.
// __tests__/og-card.test.ts fails if they drift apart.
export const OG_COLORS = {
  ink: "#0B2436", // cherenkov-ink — the dark theme's page colour
  inkRaised: "#123B57",
  cream: "#EFFFFB", // cherenkov-cream
  blue: "#5BCEFA", // cherenkov-blue
  blue300: "#97DCF6", // cherenkov-blue-300
  pink: "#F5A9B8", // cherenkov-pink
} as const;

export const OG_SIZE = { width: 1200, height: 630 } as const;

export interface OgCardProps {
  /** The headline. Sized down automatically as it gets longer. */
  title: string;
  /** One or two sentences under the headline. */
  description?: string;
  /** A single chip above the headline (an editorial's subject). */
  label?: string;
  /** A row of chips along the bottom (the home card's three subjects). */
  chips?: readonly string[];
  /** Largest headline size, for a short statement rather than a title. */
  display?: boolean;
}

// --- The artwork -------------------------------------------------------------
//
// Cherenkov radiation is light a charged particle makes when it outruns light
// *in that medium*. Each point on its path emits a spherical wavelet at the
// speed of light in the medium (u = c/n); the particle (speed v) stays ahead,
// so the wavelets pile up into a cone, the way a boat's wake does. Here:
// cos θ = u / v = 1 / (nβ), with n ≈ 1.33 (water) and β ≈ 1, so θ ≈ 41°.
// The picture below is that construction, drawn to scale: the pink particle,
// the circles it left behind, and the blue envelope they form.
const U_OVER_V = 0.75; // cos θ
const THETA = Math.acos(U_OVER_V); // angle between track and emitted light
const HALF_ANGLE = Math.asin(U_OVER_V); // half-opening of the cone (90° − θ)

const APEX = { x: 790, y: 318 };
const STEP = 64; // spacing of the remembered particle positions

function coneArtwork(): string {
  const { width: W, height: H } = OG_SIZE;
  const sin = Math.sin(HALF_ANGLE);
  const cos = Math.cos(HALF_ANGLE);
  const reach = 900;
  const farUp = { x: APEX.x + reach * cos, y: APEX.y - reach * sin };
  const farDown = { x: APEX.x + reach * cos, y: APEX.y + reach * sin };

  // One wavelet per earlier position of the particle, older = larger = fainter.
  const wavelets = Array.from({ length: 7 }, (_, i) => {
    const k = i + 1;
    const cx = APEX.x + k * STEP;
    const r = U_OVER_V * k * STEP;
    const opacity = Math.max(0.16, 0.8 - k * 0.1).toFixed(2);
    return `<circle cx="${cx}" cy="${APEX.y}" r="${r}" fill="none" stroke="${OG_COLORS.blue}" stroke-opacity="${opacity}" stroke-width="2"/>`;
  }).join("");

  // Light rays leave each wavelet's centre at θ to the track and meet the cone
  // wall at a right angle — that perpendicularity is what makes it a cone.
  const k = 4;
  const c = { x: APEX.x + k * STEP, y: APEX.y };
  const reachRay = k * STEP * sin; // |c→T| = k·STEP·sin(half-angle)
  const dir = { x: -sin, y: -cos }; // up-left, θ above the −x axis
  const tip = { x: c.x + dir.x * reachRay, y: c.y + dir.y * reachRay };
  const head = 14;
  const wing = (sign: 1 | -1) => {
    const a = Math.atan2(dir.y, dir.x) + sign * 0.42;
    return `${tip.x - head * Math.cos(a)},${tip.y - head * Math.sin(a)}`;
  };
  const ray = (flip: 1 | -1) => {
    const mirror = (p: { x: number; y: number }) => ({ x: p.x, y: APEX.y + flip * (p.y - APEX.y) });
    const a = mirror(c);
    const b = mirror(tip);
    const w1 = mirror({ x: Number(wing(1).split(",")[0]), y: Number(wing(1).split(",")[1]) });
    const w2 = mirror({ x: Number(wing(-1).split(",")[0]), y: Number(wing(-1).split(",")[1]) });
    return (
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${OG_COLORS.cream}" stroke-opacity="0.85" stroke-width="2"/>` +
      `<polygon points="${b.x},${b.y} ${w1.x},${w1.y} ${w2.x},${w2.y}" fill="${OG_COLORS.cream}" fill-opacity="0.85"/>`
    );
  };

  // The angle θ, marked once, with the glyph drawn as a path because the
  // embedded SVG has no access to the card's fonts.
  const arcR = 46;
  const arcStart = { x: c.x - arcR, y: c.y };
  const arcEnd = { x: c.x + dir.x * arcR, y: c.y + dir.y * arcR };
  const mid = { x: c.x - 0.935 * (arcR + 24), y: c.y - 0.354 * (arcR + 24) };
  const theta =
    `<path d="M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 0 1 ${arcEnd.x} ${arcEnd.y}" fill="none" stroke="${OG_COLORS.cream}" stroke-opacity="0.85" stroke-width="2"/>` +
    `<ellipse cx="${mid.x}" cy="${mid.y}" rx="5.5" ry="9" fill="none" stroke="${OG_COLORS.cream}" stroke-width="2.2"/>` +
    `<line x1="${mid.x - 5.5}" y1="${mid.y}" x2="${mid.x + 5.5}" y2="${mid.y}" stroke="${OG_COLORS.cream}" stroke-width="2.2"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="pool" cx="${APEX.x + 220}" cy="${APEX.y}" r="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${OG_COLORS.inkRaised}"/>
      <stop offset="1" stop-color="${OG_COLORS.ink}"/>
    </radialGradient>
    <linearGradient id="glow" x1="${APEX.x}" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${OG_COLORS.blue}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${OG_COLORS.blue}" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="track" x1="${APEX.x}" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${OG_COLORS.pink}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${OG_COLORS.pink}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="halo">
      <stop offset="0" stop-color="${OG_COLORS.pink}" stop-opacity="0.6"/>
      <stop offset="1" stop-color="${OG_COLORS.pink}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#pool)"/>
  <polygon points="${APEX.x},${APEX.y} ${farUp.x},${farUp.y} ${farDown.x},${farDown.y}" fill="url(#glow)"/>
  ${wavelets}
  <line x1="${APEX.x}" y1="${APEX.y}" x2="${farUp.x}" y2="${farUp.y}" stroke="${OG_COLORS.blue300}" stroke-width="2.5"/>
  <line x1="${APEX.x}" y1="${APEX.y}" x2="${farDown.x}" y2="${farDown.y}" stroke="${OG_COLORS.blue300}" stroke-width="2.5"/>
  <line x1="${APEX.x}" y1="${APEX.y}" x2="${W}" y2="${APEX.y}" stroke="url(#track)" stroke-width="3"/>
  ${ray(1)}${ray(-1)}${theta}
  <circle cx="${APEX.x}" cy="${APEX.y}" r="52" fill="url(#halo)"/>
  <circle cx="${APEX.x}" cy="${APEX.y}" r="11" fill="${OG_COLORS.pink}"/>
</svg>`;
}

// --- Type sizing ---------------------------------------------------------------

// Long editorial titles must still fit beside the artwork, so step down by
// length. The home headline is short and gets the largest size.
function titleSize(title: string, display: boolean): number {
  if (display) return 84;
  if (title.length <= 28) return 68;
  if (title.length <= 48) return 60;
  if (title.length <= 80) return 52;
  return 44;
}

const chipStyle = {
  display: "flex",
  alignItems: "center",
  padding: "7px 16px",
  borderRadius: 6,
  border: `1.5px solid ${OG_COLORS.blue300}88`,
  color: OG_COLORS.blue300,
  fontFamily: "Space Mono",
  fontSize: 22,
  lineHeight: 1,
} as const;

export function ogCard({ title, description, label, chips, display = false }: OgCardProps): ReactElement {
  const art = `data:image/svg+xml;base64,${Buffer.from(coneArtwork()).toString("base64")}`;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        background: OG_COLORS.ink,
        color: OG_COLORS.cream,
        fontFamily: "Space Grotesk",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM */}
      <img src={art} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: "absolute", left: 0, top: 0 }} />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxSizing: "border-box",
          width: 650,
          height: "100%",
          padding: "68px 0 68px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: OG_COLORS.blue }} />
          <div style={{ fontFamily: "Space Mono", fontWeight: 700, fontSize: 34, letterSpacing: -0.5 }}>
            cherenkov
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {label ? <div style={{ ...chipStyle, alignSelf: "flex-start" }}>{label}</div> : null}
          <div
            style={{
              display: "block",
              fontSize: titleSize(title, display),
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: -1.5,
              // Balancing suits the short home headline; on a long title it only
              // narrows every line and wastes the clamp.
              textWrap: title.length <= 40 ? "balance" : "wrap",
              lineClamp: 4,
            }}
          >
            {title}
          </div>
          {description ? (
            <div
              style={{
                display: "block",
                fontSize: 30,
                fontWeight: 500,
                lineHeight: 1.3,
                color: OG_COLORS.blue300,
                lineClamp: 2,
              }}
            >
              {description}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 12, height: 40 }}>
          {chips?.map((chip) => (
            <div key={chip} style={chipStyle}>
              {chip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
