import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ManifoldMascot } from "./manifold-mascot";

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("ManifoldMascot markup", () => {
  it("renders the 3D lattice with 30 edges and 12 nodes, decorative to screen readers", () => {
    const html = renderToStaticMarkup(<ManifoldMascot rotation="3d" mood="idle" />);
    expect(html).toContain('data-mode="3d"');
    expect(html).toContain('aria-hidden="true"');
    expect(count(html, "<line ")).toBe(30);
    expect(count(html, 'class="mf-node"')).toBe(12);
    expect(html).not.toContain("mf-lattice-flat");
  });

  it("flat mode hands the rotation to CSS", () => {
    const html = renderToStaticMarkup(<ManifoldMascot rotation="flat" />);
    expect(html).toContain('data-mode="flat"');
    expect(html).toContain("mf-lattice-flat");
  });

  it("exposes the mood to CSS", () => {
    expect(renderToStaticMarkup(<ManifoldMascot mood="thinking" />)).toContain('data-mood="thinking"');
  });

  it("lite avatars are always flat and drop trails, sparkles and the comet", () => {
    const html = renderToStaticMarkup(<ManifoldMascot rotation="3d" lite />);
    expect(html).toContain('data-mode="flat"');
    expect(html).not.toContain("mf-trails");
    expect(html).not.toContain("mf-sparkles");
    expect(html).not.toContain("mf-comet");
  });

  it("gives every instance its own gradient ids (header, dock and floating window)", () => {
    const html = renderToStaticMarkup(
      <>
        <ManifoldMascot />
        <ManifoldMascot />
      </>,
    );
    const ids = [...html.matchAll(/<radialGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
