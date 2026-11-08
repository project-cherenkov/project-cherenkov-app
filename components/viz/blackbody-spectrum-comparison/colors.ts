import type { PlotColors } from "./draw";

// The canvas cannot use Tailwind classes, so it reads the site's CSS custom
// properties (app/globals.css) when it draws. Each token is an "H S% L%"
// triple that changes with the .dark class, so a theme switch only needs a
// redraw. The fallbacks are the light-theme values, used where the properties
// do not exist (a test DOM, a page without the stylesheet).
const FALLBACKS = {
  "--card": "0 0% 100%",
  "--border": "349 61% 88%",
  "--border-strong": "215 16% 47%",
  "--foreground": "205 66% 13%",
  "--muted-foreground": "215 19% 35%",
  "--brand": "197 84% 30%",
  "--viz-secondary": "348 79% 46%",
} as const;

type Token = keyof typeof FALLBACKS;

function color(style: CSSStyleDeclaration, token: Token, alpha = 1): string {
  const raw = style.getPropertyValue(token).trim() || FALLBACKS[token];
  const parts = raw.split(/\s+/);
  const [h, s, l] = parts;
  return alpha >= 1 ? `hsl(${h}, ${s}, ${l})` : `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

export function readPlotColors(element: Element): PlotColors {
  const style = getComputedStyle(element);
  return {
    surface: color(style, "--card"),
    gridMinor: color(style, "--border"),
    gridMajor: color(style, "--border-strong", 0.45),
    axis: color(style, "--border-strong"),
    text: color(style, "--foreground"),
    mutedText: color(style, "--muted-foreground"),
    primary: color(style, "--brand"),
    secondary: color(style, "--viz-secondary"),
    guide: color(style, "--foreground", 0.55),
  };
}
