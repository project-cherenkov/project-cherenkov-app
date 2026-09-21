import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneBuilderApp } from "./scene-builder-app";

// programmable-scene mode renders the real ProgrammableScene component
// (see the tests below), which calls useTranslations — same mock as
// components/viz/programmable-scene/index.test.tsx uses for the same
// reason.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// The Save button's own className always contains the literal substring
// "disabled" (Tailwind's disabled:pointer-events-none / disabled:opacity-50
// variants), whether or not the button actually is — so a plain /disabled/
// regex against the whole tag is a false positive waiting to happen,
// specifically the moment a test asserts the *negative* (button enabled).
// This checks for React's actual serialized boolean attribute (`disabled=""`)
// within the button's own opening tag only.
function isSaveButtonDisabled(html: string): boolean {
  const match = html.match(/<button([^>]*)>\s*(?:Saving…|Save to editorial)/);
  if (!match) throw new Error("Save to editorial button not found in rendered output");
  return /\bdisabled=""/.test(match[1] ?? "");
}

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
    expect(isSaveButtonDisabled(html)).toBe(true);
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

// PROG-005: the engine-select step this repository didn't previously have
// (see the implementation report's Deviations section) — these are new
// coverage for the new toggle, not modifications of the tests above, which
// keep passing unmodified against the (still default) composed-scene
// branch.
describe("SceneBuilderApp — engine select (PROG-005)", () => {
  it("defaults to composed-scene when no initialEngine is given", () => {
    const html = renderToStaticMarkup(<SceneBuilderApp />);
    expect(html).toMatch(/<input type="radio" name="scene-builder-engine"[^>]*checked[^>]*value="composed-scene"/);
  });

  it("renders the block editor and program preview when initialEngine is programmable-scene", () => {
    const html = renderToStaticMarkup(<SceneBuilderApp initialEngine="programmable-scene" />);
    expect(html).toMatch(/<input type="radio" name="scene-builder-engine"[^>]*checked[^>]*value="programmable-scene"/);
    expect(html).toContain('data-testid="block-editor-workspace"');
    // An empty program is valid (an empty sequence) — the live preview
    // should show, not the "not valid yet" placeholder.
    expect(html).toContain('data-testid="programmable-scene-canvas"');
    expect(html).not.toContain("isn&#x27;t valid yet");
  });

  // Generalizing lib/scene-builder-write.ts to cover programmable-scene
  // (this feature's own prerequisite — see its test suite) means this
  // engine's Save button no longer needs to be hard-disabled the way it
  // was; these two tests replace the old single "always disabled, with an
  // explanation" test with composed-scene's own enabled/disabled split.
  it("enables Save once a program and target are valid, without touching composed-scene's own Save button behavior", () => {
    const html = renderToStaticMarkup(
      <SceneBuilderApp
        initialEngine="programmable-scene"
        initialSubject="physics"
        initialSlug="projectile-range-symmetry"
      />,
    );
    // An empty program is a valid (empty) sequence, and subject+slug are
    // prefilled, so — unlike before this write path existed — Save is
    // enabled here, the same way it is for composed-scene once its own
    // preconditions are met.
    expect(isSaveButtonDisabled(html)).toBe(false);
  });

  it("disables Save for programmable-scene until a subject/slug target is chosen", () => {
    const html = renderToStaticMarkup(<SceneBuilderApp initialEngine="programmable-scene" />);
    expect(isSaveButtonDisabled(html)).toBe(true);
    expect(html).toContain("Choose a subject and slug above to enable saving.");
  });

  it("does not render the composed-scene palette or timeline in programmable-scene mode", () => {
    const html = renderToStaticMarkup(<SceneBuilderApp initialEngine="programmable-scene" />);
    expect(html).not.toContain('data-testid="composed-scene-canvas"');
    expect(html).not.toContain("No timeline steps yet");
  });
});
