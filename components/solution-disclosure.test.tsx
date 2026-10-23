import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { Solution, TryFirstToggle } from "./solution-disclosure";

describe("Solution", () => {
  it("renders the full text, with no disclosure, in server-rendered HTML", () => {
    // The server snapshot is "off": search engines, print and no-JS readers
    // always get the whole proof. Collapsing only happens in the browser for
    // readers who opted in.
    const html = renderToStaticMarkup(
      <Solution>
        <p>The full proof.</p>
      </Solution>,
    );
    expect(html).toContain("The full proof.");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("showSolution");
  });
});

describe("TryFirstToggle", () => {
  it("is an unchecked, labelled checkbox by default (opt-in, never the default)", () => {
    const html = renderToStaticMarkup(<TryFirstToggle />);
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("checked");
    expect(html).toContain("tryFirstLabel");
    expect(html).toContain("tryFirstHint");
  });
});
