import { describe, expect, it } from "vitest";

import { parseUnderstoodTarget } from "./understood";

const lookup = {
  hasMaterial: (subject: string, slug: string) => subject === "informatics" && slug === "binary-search",
  hasEditorial: (subject: string, slug: string) => subject === "physics" && slug === "projectile-range-symmetry",
};

describe("parseUnderstoodTarget", () => {
  it("accepts pages that exist", () => {
    expect(parseUnderstoodTarget({ kind: "material", subject: "informatics", slug: "binary-search" }, lookup)).toEqual({
      kind: "material",
      subject: "informatics",
      slug: "binary-search",
    });
    expect(
      parseUnderstoodTarget({ kind: "editorial", subject: "physics", slug: "projectile-range-symmetry" }, lookup),
    ).not.toBeNull();
  });

  it("rejects pages that do not exist, or exist under another kind or subject", () => {
    expect(parseUnderstoodTarget({ kind: "editorial", subject: "informatics", slug: "binary-search" }, lookup)).toBeNull();
    expect(parseUnderstoodTarget({ kind: "material", subject: "physics", slug: "binary-search" }, lookup)).toBeNull();
    expect(parseUnderstoodTarget({ kind: "material", subject: "informatics", slug: "nope" }, lookup)).toBeNull();
  });

  it("rejects malformed input", () => {
    for (const input of [
      null,
      undefined,
      {},
      { kind: "page", subject: "informatics", slug: "binary-search" },
      { kind: "material", subject: "chemistry", slug: "binary-search" },
      { kind: "material", subject: "informatics", slug: "../x" },
      { kind: "material", subject: "informatics", slug: 42 },
    ]) {
      expect(parseUnderstoodTarget(input as never, lookup)).toBeNull();
    }
  });
});
