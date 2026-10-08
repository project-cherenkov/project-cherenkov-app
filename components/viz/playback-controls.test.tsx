import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { PlaybackControls } from "./playback-controls";

function render(isPlaying: boolean) {
  return renderToStaticMarkup(
    <PlaybackControls
      current={3}
      total={10}
      isPlaying={isPlaying}
      onPlayPause={() => {}}
      onStep={() => {}}
      onScrub={() => {}}
      onReset={() => {}}
      label="Step 4 of 11"
    />,
  );
}

describe("PlaybackControls accessibility", () => {
  it("announces the step label politely when the reader is stepping", () => {
    expect(render(false)).toMatch(/role="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="status"/);
  });

  it("goes quiet while auto-playing, so a screen reader isn't read every frame", () => {
    expect(render(true)).toContain('aria-live="off"');
    expect(render(true)).not.toContain('aria-live="polite"');
  });

  it("names the scrub slider, not just 'value'", () => {
    const html = render(false);
    const thumb = html.match(/<span[^>]*role="slider"[^>]*>/)?.[0] ?? "";
    expect(thumb).toContain('aria-label="scrub"');
  });

  it("uses theme tokens rather than a hard-coded white surface (dark mode)", () => {
    // Look at the outer container only — the slider thumb legitimately keeps
    // its own bg-white / dark:bg-slate-900 pair.
    const container = render(false).match(/^<div class="([^"]*)"/)?.[1] ?? "";
    expect(container).toContain("bg-card");
    expect(container).not.toContain("bg-white");
  });
});
