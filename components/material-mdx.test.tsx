import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { MaterialMDX } from "./material-mdx";

// Same compiled-MDX fixture shape as editorial-mdx.test.tsx.
function makeCode(bodyReturn: string): string {
  return `
    const { jsx: e, jsxs: s, Fragment: F } = arguments[0];
    function _createMdxContent(props) {
      const { Interactive } = props.components || {};
      return ${bodyReturn};
    }
    return { default: function (props) { return _createMdxContent(props); } };
  `;
}

const withTag = makeCode(`s(F, { children: [e("p", { children: "Prose." }), e(Interactive, {})] })`);
const withoutTag = makeCode(`e("p", { children: "Prose only." })`);
const none = { discriminant: "none" as const, value: {} };
// A config the graph-array-stepper guard rejects renders its error state,
// which is enough to tell that the engine WAS mounted.
const configured = { discriminant: "graph-array-stepper" as const, value: {} };

describe("MaterialMDX — visualization is optional", () => {
  it("renders nothing extra for a material without a visualization", () => {
    const html = renderToStaticMarkup(<MaterialMDX code={withoutTag} vizConfig={none} />);
    expect(html).toContain("Prose only.");
    expect(html).not.toContain("vizFallbackNotice");
    expect(html).not.toContain("vizMissing"); // that placeholder is an editorial-only error
  });

  it("a stray <Interactive /> in a material with no visualization renders nothing", () => {
    const html = renderToStaticMarkup(<MaterialMDX code={withTag} vizConfig={none} />);
    expect(html).toContain("Prose.");
    expect(html).not.toContain("vizMissing");
    expect(html).not.toContain("vizFallbackNotice");
  });

  it("mounts the engine at the tag, with no notice, when configured and placed", () => {
    const html = renderToStaticMarkup(<MaterialMDX code={withTag} vizConfig={configured} />);
    expect(html).not.toContain("vizFallbackNotice");
    expect(html).toContain("vizConfigError");
  });

  it("falls back to showing the engine above the body, with a notice, when the tag is forgotten", () => {
    const html = renderToStaticMarkup(<MaterialMDX code={withoutTag} vizConfig={configured} />);
    expect(html).toContain("vizFallbackNotice");
    expect(html.indexOf("vizFallbackNotice")).toBeLessThan(html.indexOf("Prose only."));
  });
});
