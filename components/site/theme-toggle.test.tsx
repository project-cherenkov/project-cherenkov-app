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

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with accessible aria-label", () => {
    mockResolvedTheme = "light";
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain('aria-label="Toggle theme"');
  });

  it("calls setTheme with dark when currently light", () => {
    mockResolvedTheme = "light";
    const element = ThemeToggle();
    element.props.onClick();
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme with light when currently dark", () => {
    mockResolvedTheme = "dark";
    const element = ThemeToggle();
    element.props.onClick();
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
