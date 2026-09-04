import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Same render-test convention as the rest of this repo's component tests.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { VizEngine } from "./viz-engine";

// next/dynamic's ssr:false components render nothing at all during a
// server render (that's the documented point of ssr:false — skip SSR
// entirely for browser-API-dependent code) — true for all four engines
// alike, not something specific to composed-scene. So a successful
// dispatch is verified here by confirming the switch reaches past the
// guard into the dynamic-import branch (neither VizConfigError nor
// VizMissing renders) rather than by asserting on the engine's own DOM,
// which renderToStaticMarkup structurally cannot observe for any of the
// four cases. The engine's own rendering is covered by its own component
// test/type-guard test instead.
describe("VizEngine dispatch", () => {
  it("renders VizConfigError, not the engine or VizMissing, for an invalid composed-scene config", () => {
    const html = renderToStaticMarkup(
      <VizEngine
        editorial={{ vizEngine: "composed-scene", vizConfig: { not: "a valid scene" } }}
      />,
    );
    expect(html).toContain("vizConfigError");
    expect(html).not.toContain("vizMissing");
  });

  it("does not fall through to VizConfigError/VizMissing for a valid composed-scene config", () => {
    const html = renderToStaticMarkup(
      <VizEngine
        editorial={{
          vizEngine: "composed-scene",
          vizConfig: {
            canvas: { widthPx: 320, heightPx: 200 },
            elements: [
              { id: "el-1", templateId: "shape-circle", params: { x: 40, y: 40, radius: 10 } },
            ],
          },
        }}
      />,
    );
    expect(html).not.toContain("vizConfigError");
    expect(html).not.toContain("vizMissing");
  });

  it("still renders VizMissing for vizEngine: none, unaffected by the new case", () => {
    const html = renderToStaticMarkup(<VizEngine editorial={{ vizEngine: "none", vizConfig: {} }} />);
    expect(html).toContain("vizMissing");
  });

  it("still renders VizConfigError for an invalid trajectory-sandbox config, unaffected by the new case", () => {
    const html = renderToStaticMarkup(
      <VizEngine editorial={{ vizEngine: "trajectory-sandbox", vizConfig: { not: "valid" } }} />,
    );
    expect(html).toContain("vizConfigError");
  });
});
