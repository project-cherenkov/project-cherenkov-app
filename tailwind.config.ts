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
          blue: "#8AD7FF",
          "blue-pastel": "#5BCEFA",
          pink: "#FFC8E6",
          "pink-pastel": "#F5A9B8",
          offwhite: "#EFFFFB",
        },
      },
      fontFamily: {
        // PLACEHOLDER: no typeface has been chosen yet (see Open Questions §12).
        // Using the system UI stack so nothing renders broken in the meantime —
        // swap these two lines out once type is decided, nothing else should
        // need to change.
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
