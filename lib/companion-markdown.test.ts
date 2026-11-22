import { describe, expect, it } from "vitest";
import { classifyHref, prepareChatMarkdown } from "./companion-markdown";

describe("classifyHref", () => {
  it("allows known internal routes and https links", () => {
    expect(classifyHref("/archive/physics/doppler")).toEqual({ kind: "internal", href: "/archive/physics/doppler" });
    expect(classifyHref("https://example.org/a")).toMatchObject({ kind: "external" });
  });
  it("shows every other scheme or unknown path as text", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "http://example.org", "mailto:a@b.c", "//evil.example", "/unknown/page", "/\\evil", "", undefined]) {
      expect(classifyHref(href)).toEqual({ kind: "text" });
    }
  });
});

describe("prepareChatMarkdown", () => {
  it("converts \\(...\\) and \\[...\\] to dollar delimiters", () => {
    expect(prepareChatMarkdown("so \\(E=mc^2\\) holds")).toBe("so $E=mc^2$ holds");
    expect(prepareChatMarkdown("\\[x^2\\]")).toContain("$$x^2$$");
  });
  it("keeps real maths", () => {
    expect(prepareChatMarkdown("let $x$ be small and $$y=1$$")).toBe("let $x$ be small and $$y=1$$");
  });
  it("does not let currency swallow the paragraph", () => {
    expect(prepareChatMarkdown("it costs $5 and $6")).toBe("it costs \\$5 and \\$6");
  });
  it("escapes a lone or unclosed dollar sign", () => {
    expect(prepareChatMarkdown("an unclosed $x here")).toBe("an unclosed \\$x here");
  });
  it("leaves code alone, including an unclosed fence", () => {
    expect(prepareChatMarkdown("`$5 and $6`")).toBe("`$5 and $6`");
    expect(prepareChatMarkdown("```\ncost $5 and $6")).toBe("```\ncost $5 and $6");
  });
});
