import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (key === "skipToContent" ? "Skip to main content" : key),
}));

import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("targets the main landmark and is only visible on focus", () => {
    const html = renderToStaticMarkup(<SkipLink />);
    expect(html).toContain('href="#main-content"');
    expect(html).toContain("Skip to main content");
    expect(html).toContain("sr-only");
    expect(html).toContain("focus:not-sr-only");
  });
});
