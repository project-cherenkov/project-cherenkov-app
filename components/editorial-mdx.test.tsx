import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { EditorialMDX } from "./editorial-mdx";

// Fixture "compiled MDX" source strings, hand-written in the same shape
// Velite's real MDX compiler produces (verified against
// .velite/editorials.json for a real editorial during implementation:
// `arguments[0]` is fed `{...runtime}` from react/jsx-runtime by
// useMDXComponent's `new Function(code)` call, and the compiled module's
// `default` export — when no `components.wrapper` is passed, which it
// never is here — just calls `_createMdxContent(props)` directly and
// returns its result).
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

const properlyEmbedded = makeCode(
  `s(F, { children: [e("p", { children: "Some prose." }), e(Interactive, {})] })`,
);

const proseOnlyMentioningInteractive = makeCode(
  `s(F, { children: [e("p", { children: "This proof relies on an Interactive predicate, but never embeds the tag." })] })`,
);

const noMentionAtAll = makeCode(`e("p", { children: "Nothing relevant here." })`);

describe("EditorialMDX — F-05 real-usage detection", () => {
  it("renders the visualization with no notice when <Interactive/> is actually placed", () => {
    const html = renderToStaticMarkup(
      <EditorialMDX code={properlyEmbedded} vizConfig={{ discriminant: "none", value: {} }} />,
    );
    // VizEngine renders exactly once (from the real Interactive placeholder
    // itself), and the "forgot the tag" notice never appears.
    expect(html.split("vizMissing").length - 1).toBe(1);
    expect(html).not.toContain("vizFallbackNotice");
  });

  it("renders the fallback + notice for a body with no <Interactive/> tag at all", () => {
    const html = renderToStaticMarkup(
      <EditorialMDX
        code={noMentionAtAll}
        vizConfig={{ discriminant: "programmable-scene", value: {} }}
      />,
    );
    expect(html).toContain("vizFallbackNotice");
  });

  // The actual F-05 regression case: previously
  // `editorial.body.includes("Interactive")` would have matched this
  // prose text and suppressed the fallback entirely, shipping the
  // editorial with no visualization at all.
  it("still renders the fallback + notice when prose merely contains the word 'Interactive' without the tag", () => {
    const html = renderToStaticMarkup(
      <EditorialMDX
        code={proseOnlyMentioningInteractive}
        vizConfig={{ discriminant: "programmable-scene", value: {} }}
      />,
    );
    expect(html).toContain("vizFallbackNotice");
    expect(html).toContain("Interactive predicate");
  });

  it("renders the fallback without the notice when the engine is genuinely unconfigured (discriminant: none) and the tag is missing", () => {
    const html = renderToStaticMarkup(
      <EditorialMDX
        code={proseOnlyMentioningInteractive}
        vizConfig={{ discriminant: "none", value: {} }}
      />,
    );
    expect(html).toContain("vizMissing");
    expect(html).not.toContain("vizFallbackNotice");
  });
});
