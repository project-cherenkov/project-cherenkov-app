import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let mockPathname = "/syllabus";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => mockPathname,
}));

import { ArchiveSubnav, isTabActive } from "./archive-subnav";

function render(pathname: string) {
  mockPathname = pathname;
  return renderToStaticMarkup(<ArchiveSubnav />);
}

function currentHrefs(html: string): string[] {
  return [...html.matchAll(/<a href="([^"]+)"[^>]*aria-current="page"/g)].map((m) => m[1]!);
}

describe("ArchiveSubnav", () => {
  it("links to all three sections, in order, inside a labelled <nav>", () => {
    const html = render("/syllabus");
    expect(html).toContain('<nav aria-label="archiveSections"');
    const hrefs = [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/syllabus", "/materials", "/archive"]);
  });

  it.each([
    ["/syllabus", "/syllabus"],
    ["/syllabus/physics", "/syllabus"],
    ["/materials/informatics/binary-search", "/materials"],
    ["/archive", "/archive"],
    ["/archive/informatics/binary-search-on-answer", "/archive"],
  ])("marks exactly one tab current on %s", (pathname, expected) => {
    expect(currentHrefs(render(pathname))).toEqual([expected]);
  });

  it("marks nothing current outside the archive sections", () => {
    expect(currentHrefs(render("/about"))).toEqual([]);
  });

  it("does not treat a lookalike prefix as a match", () => {
    expect(isTabActive("/archived", "/archive")).toBe(false);
  });
});
