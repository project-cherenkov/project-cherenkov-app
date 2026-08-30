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
          blue: {
            DEFAULT: "#5BCEFA",
            50: "#F4F9FB",
            100: "#E8F3F8",
            200: "#CBEAF6",
            300: "#97DCF6",
            400: "#57CDFA",
            500: "#20BCF8",
            600: "#07A7E4",
            700: "#0A88B8",
            800: "#0C698D",
            900: "#0B4C65",
          },
          "blue-alt": "#8AD7FF",
          "blue-pastel": "#8AD7FF",
          pink: {
            DEFAULT: "#F5A9B8",
            50: "#FAF5F6",
            100: "#F6E9EC",
            200: "#F3CED5",
            300: "#EF9FAF",
            400: "#ED647F",
            500: "#E73155",
            600: "#D2183D",
            700: "#AA1835",
            800: "#83162C",
            900: "#5E1221",
          },
          "pink-alt": "#FFC8E6",
          "pink-pastel": "#FFC8E6",
          cream: "#EFFFFB",
          white: "#FFFFFF",
          ink: "#0B2436",
          offwhite: "#EFFFFB",
        },
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: "hsl(var(--primary) / <alpha-value>)",
        secondary: "hsl(var(--secondary) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
      },
      fontFamily: {
        // Blue and white are literal to Cherenkov radiation (the glow emitted when
        // a charged particle outruns light's own speed in a transparent medium);
        // pink signals the project's approachable, non-intimidating character.
        // The ink color isn't from brand intent — it's there purely so text stays
        // readable on the pastel backgrounds.
        sans: [
          "var(--font-body)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        heading: [
          "var(--font-heading)",
          "var(--font-body)",
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
