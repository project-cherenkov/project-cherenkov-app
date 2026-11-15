/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/id/nowhere",
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ErrorState } from "./error-state";

const base = { heading: "Something went wrong", body: "Try again.", ctaLabel: "Try again" };

describe("ErrorState", () => {
  it("renders the retry button when given onRetry, and a link when given ctaHref", () => {
    expect(renderToStaticMarkup(<ErrorState {...base} onRetry={() => {}} />)).toContain("<button");
    const link = renderToStaticMarkup(<ErrorState {...base} ctaHref="/" />);
    expect(link).toContain('href="/"');
    expect(link).not.toContain("<button");
  });

  it("only shows the swap button when there is more than one flavour line and a label", () => {
    const one = renderToStaticMarkup(<ErrorState {...base} flavour={["only"]} anotherLabel="Another" />);
    expect(one).not.toContain("Another");
    const noLabel = renderToStaticMarkup(<ErrorState {...base} flavour={["a", "b"]} />);
    expect(noLabel).not.toContain("<button");
    const two = renderToStaticMarkup(<ErrorState {...base} flavour={["a", "b"]} anotherLabel="Another" />);
    expect(two).toContain("Another");
  });

  it("has no flavour slot at all without flavour lines", () => {
    expect(renderToStaticMarkup(<ErrorState {...base} />)).not.toContain("cx-flavour");
  });

  it("never renders a flavour line on the server, so it cannot mismatch the client", () => {
    const html = renderToStaticMarkup(
      <ErrorState {...base} flavour={["The path was {path}."]} anotherLabel="Another" echoPath />,
    );
    expect(html).not.toContain("The path was");
    expect(html).not.toContain("/id/nowhere");
  });

  it("keeps the corruption out of the accessibility tree and leaves the heading as the only h1", () => {
    const html = renderToStaticMarkup(<ErrorState {...base} code="ERR" />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('data-text="ERR"');
    expect(html).toMatch(/class="cx-code[^"]*"[^>]*aria-hidden="true"/);
    expect(html).toContain('class="cx-layer" aria-hidden="true"');
  });
});
