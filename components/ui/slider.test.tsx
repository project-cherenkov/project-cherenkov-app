import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Slider } from "./slider";

// Regression: the thumb used to hard-code aria-label="value", so every slider
// in every visualization was announced as just "value" regardless of the
// label its caller passed.
describe("Slider accessible name", () => {
  it("puts the caller's aria-label on the thumb (the role=slider element)", () => {
    const html = renderToStaticMarkup(
      <Slider aria-label="e = 0.30" min={0} max={1} step={0.01} value={[0.3]} />,
    );
    const thumb = html.match(/<span[^>]*role="slider"[^>]*>/)?.[0] ?? "";
    expect(thumb).toContain('aria-label="e = 0.30"');
    expect(html).not.toContain('aria-label="value"');
  });

  it("supports aria-labelledby too", () => {
    const html = renderToStaticMarkup(
      <Slider aria-labelledby="lbl" min={0} max={10} value={[3]} />,
    );
    const thumb = html.match(/<span[^>]*role="slider"[^>]*>/)?.[0] ?? "";
    expect(thumb).toContain('aria-labelledby="lbl"');
  });
});
