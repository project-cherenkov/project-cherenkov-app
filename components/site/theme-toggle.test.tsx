import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockSetTheme = vi.fn();
let mockResolvedTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockResolvedTheme,
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

import { ThemeToggle, nextTheme } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with accessible aria-label", () => {
    mockResolvedTheme = "light";
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain('aria-label="Toggle theme"');
  });
});

// nextTheme is the pure logic ThemeToggle's click handler delegates to.
// Tested directly rather than through ThemeToggle itself, which needs a
// real React render pass (renderToStaticMarkup, above) for its hooks to
// work — calling the component as a plain function bypasses React's
// dispatcher and throws "Invalid hook call".
describe("nextTheme", () => {
  it("flips to dark when currently light", () => {
    expect(nextTheme("light")).toBe("dark");
  });

  it("flips to light when currently dark", () => {
    expect(nextTheme("dark")).toBe("light");
  });
});
