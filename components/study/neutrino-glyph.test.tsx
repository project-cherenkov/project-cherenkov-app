import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NeutrinoGlyph } from "./neutrino-glyph";

describe("NeutrinoGlyph", () => {
  it("is decorative and drawn from rectangles, not text", () => {
    for (const kind of ["question", "dots", "alert"] as const) {
      const html = renderToStaticMarkup(<NeutrinoGlyph kind={kind} />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("<rect");
      expect(html).not.toContain("<text");
    }
  });
  it("animates the three dots with their own classes", () => {
    const html = renderToStaticMarkup(<NeutrinoGlyph kind="dots" />);
    expect(html).toContain("nt-dot-1");
    expect(html).toContain("nt-dot-3");
  });
});
