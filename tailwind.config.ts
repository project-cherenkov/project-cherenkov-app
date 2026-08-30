import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

// Design tokens straight from the Identity spec (Section 4 of the build spec).
// Keep all Cherenkov brand colors here — never hardcode a hex in a component.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cherenkov: {
          blue: "#5BCEFA",
          "blue-alt": "#8AD7FF",
          "blue-pastel": "#8AD7FF",
          pink: "#F5A9B8",
          "pink-alt": "#FFC8E6",
          "pink-pastel": "#FFC8E6",
          cream: "#EFFFFB",
          white: "#FFFFFF",
          ink: "#0B2436",
          offwhite: "#EFFFFB",
        },
      },
      fontFamily: {
        // Blue and white are literal to Cherenkov radiation (the glow emitted when
        // a charged particle outruns light's own speed in a transparent medium);
        // pink signals the project's approachable, non-intimidating character.
        // The ink color isn't from brand intent — it's there purely so text stays
        // readable on the pastel backgrounds.
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // Used for the catournament.org-style code labels (readme.md, tags,
        // step counters in the viz engines) — this one's a deliberate choice,
        // not a placeholder, since "code-styled" implies a real mono face.
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
          },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
