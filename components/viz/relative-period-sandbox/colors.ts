import type { SceneColors } from "./draw";

// The canvas cannot use Tailwind classes, so it reads the site's CSS custom
// properties (app/globals.css) when it draws; nothing is hard-coded. Each
// token is an "H S% L%" triple that changes with the .dark class, so a theme
// switch only needs a redraw. The fallbacks are the light-theme values, used
// where the properties do not exist (a test DOM, a page without the
// stylesheet).
const FALLBACKS = {
  "--card": "0 0% 100%",
  "--border-strong": "215 16% 47%",
  "--foreground": "205 66% 13%",
  "--muted-foreground": "215 19% 35%",
  "--brand": "197 84% 30%",
  "--viz-secondary": "348 79% 46%",
} as const;

type Token = keyof typeof FALLBACKS;

function color(style: CSSStyleDeclaration, token: Token, alpha = 1): string {
  const raw = style.getPropertyValue(token).trim() || FALLBACKS[token];
  const [h, s, l] = raw.split(/\s+/);
  return alpha >= 1 ? `hsl(${h}, ${s}, ${l})` : `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

export function readSceneColors(element: Element): SceneColors {
  const style = getComputedStyle(element);
  return {
    surface: color(style, "--card"),
    grid: color(style, "--border-strong", 0.55),
    text: color(style, "--foreground"),
    mutedText: color(style, "--muted-foreground"),
    primary: color(style, "--brand"),
    secondary: color(style, "--viz-secondary"),
  };
}
