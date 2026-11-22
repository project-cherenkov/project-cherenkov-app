import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/routing", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("katex/dist/katex.min.css", () => ({}));

import NeutrinoMarkdown from "./neutrino-markdown";

const html = (text: string) => renderToStaticMarkup(<NeutrinoMarkdown text={text} />);

describe("NeutrinoMarkdown", () => {
  it("renders lists, bold and headings, with headings below level 3", () => {
    const out = html("# Title\n\n- one\n- **two**");
    expect(out).toContain("<li>");
    expect(out).toContain("<strong>two</strong>");
    expect(out).not.toMatch(/<h[1-6]/);
    expect(out).toContain('aria-level="3"');
  });
  it("renders maths from $…$ and \\(…\\), but not currency", () => {
    expect(html("so $x^2$ holds")).toContain("katex");
    expect(html("so \\(x^2\\) holds")).toContain("katex");
    const money = html("it costs $5 and $6");
    expect(money).not.toContain("katex");
    expect(money).toContain("$5 and $6");
  });
  it("shows raw HTML as text and never loads images", () => {
    const out = html('<script>alert(1)</script> ![cat](https://evil.example/x.png)');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("cat");
  });
  it("restricts links", () => {
    const out = html("[a](javascript:alert(1)) [b](https://example.org) [c](/archive/physics/x) [d](http://example.org)");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("http://example.org");
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('href="/archive/physics/x"');
  });
  it("does not throw on incomplete or invalid markdown", () => {
    for (const text of ["- item\n- **unclosed", "```\nunclosed fence", "$$\n\\frac{", "$\\badmacro{$", "$x"]) {
      expect(() => html(text)).not.toThrow();
    }
  });
});
