import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneBuilderApp } from "./scene-builder-app";

describe("SceneBuilderApp — initial render", () => {
  it("renders the palette, target-editorial fields, and a disabled Save button with no elements yet", () => {
    const html = renderToStaticMarkup(<SceneBuilderApp />);

    // Palette: spot-check a couple of template labels from the registry.
    expect(html).toContain("Circle");
    expect(html).toContain("Curve — sine");

    // Target editorial fields, with no query-param prefill.
    expect(html).toContain("Choose a subject");
    expect(html).toContain("binary-search-on-answer"); // slug placeholder

    // No elements yet -> preview placeholder, not the live canvas.
    expect(html).toContain("Add at least one element to see a preview.");
    expect(html).not.toContain('data-testid="composed-scene-canvas"');

    // Empty timeline is a valid, explained state (static scene), not an error.
    expect(html).toContain("No timeline steps yet");

    // Save is disabled until both target fields and a valid config exist.
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Save to editorial/);
  });

  it("prefills subject/slug from props (the A-1 deep-link path) when given a known subject", () => {
    const html = renderToStaticMarkup(
      <SceneBuilderApp initialSubject="physics" initialSlug="projectile-range-symmetry" />,
    );
    expect(html).toContain('value="projectile-range-symmetry"');
    expect(html).toContain('<option value="physics" selected');
  });

  it("ignores an unrecognized initialSubject rather than silently trusting it", () => {
    const html = renderToStaticMarkup(<SceneBuilderApp initialSubject="chemistry" initialSlug="x" />);
    expect(html).toContain("Choose a subject");
    expect(html).not.toContain('<option value="chemistry"');
  });
});
