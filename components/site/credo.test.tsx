import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Credo } from "./credo";

describe("Credo", () => {
  const html = renderToStaticMarkup(<Credo />);
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  it("reads exactly as the motto in docs/project/product-identity.md, with U+00B7", () => {
    expect(text).toBe("Cognitio \u00B7 Humanitas \u00B7 Exploratio");
  });

  it("is marked as Latin, because it is not translated", () => {
    expect(html).toContain('lang="la"');
  });

  it("keeps the separators out of the accessibility tree", () => {
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it("never uses the abbreviation the identity file forbids", () => {
    expect(html).not.toMatch(/\bCHE\b/);
  });
});
