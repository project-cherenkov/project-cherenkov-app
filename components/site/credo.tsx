// The project's credo, "Cognitio · Humanitas · Exploratio", shown on the home
// hero in place of the old "5 editorials · 2 materials · 3 syllabuses" line.
//
// It is a constant, not a message: the motto is identical in both interface
// languages (docs/project/product-identity.md), so it is marked lang="la" and
// never translated. The middle dot is U+00B7. Keep the file UTF-8.
//
// Each word takes the colour of its role (docs/design/colour.md): Cognitio is
// blue (the phenomenon), Humanitas is pink (the learner), Exploratio is the
// pale flash of insight. The pastels are never text, so each word uses the
// deeper step in light mode and the lighter step in dark mode, chosen so that
// every word reaches 4.5:1 even on the strongest part of the hero glow. The
// ratios are in colour.md.
//
// Exploratio's resting colour is the page's own foreground (ink in light,
// pale in dark). It then plays one slow colour pass through the other two hues
// when the page loads (see `.credo-exploratio` in app/globals.css).
export function Credo({ className }: { className?: string }) {
  return (
    <p
      lang="la"
      className={["font-mono text-sm font-semibold tracking-wide", className].filter(Boolean).join(" ")}
    >
      <span className="text-cherenkov-blue-800 dark:text-cherenkov-blue-300">Cognitio</span>
      <span aria-hidden="true" className="text-muted-foreground">
        {" "}
        ·{" "}
      </span>
      <span className="text-cherenkov-pink-700 dark:text-cherenkov-pink-200">Humanitas</span>
      <span aria-hidden="true" className="text-muted-foreground">
        {" "}
        ·{" "}
      </span>
      <span className="credo-exploratio">Exploratio</span>
    </p>
  );
}
