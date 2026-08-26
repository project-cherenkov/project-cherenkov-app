import { describe, expect, it } from "vitest";
import { deriveTopicsFromEditorials, type EditorialLike } from "./derive-topics";

// DB-002 required test: "unit test that the seed derivation logic produces
// one topics row per real editorial file found."
describe("deriveTopicsFromEditorials", () => {
  it("produces exactly one topic per editorial", () => {
    const editorials: EditorialLike[] = [
      {
        subject: "informatics",
        slug: "binary-search-on-answer",
        title: "Binary Search on the Answer",
        principle: "monotonic-predicate-search",
        publishedAt: "2026-08-01",
      },
      {
        subject: "physics",
        slug: "projectile-range-symmetry",
        title: "Projectile Range Symmetry",
        principle: "trigonometric-symmetry-in-kinematics",
        publishedAt: "2026-08-01",
      },
      {
        subject: "astronomy",
        slug: "eccentric-transit-duration",
        title: "Eccentric Orbits Have Uneven Transits",
        principle: "keplers-second-law-and-transit-duration",
        publishedAt: "2026-08-01",
      },
    ];

    const derived = deriveTopicsFromEditorials(editorials);

    expect(derived).toHaveLength(editorials.length);
    for (const editorial of editorials) {
      const match = derived.find((t) => t.editorialSlug === editorial.slug);
      expect(match).toBeDefined();
      expect(match?.subject).toBe(editorial.subject);
      expect(match?.title).toBe(editorial.title);
      expect(match?.chapter).toBe(editorial.principle);
    }
  });

  it("orders topics within a subject oldest-to-newest by publishedAt", () => {
    const editorials: EditorialLike[] = [
      {
        subject: "informatics",
        slug: "second",
        title: "Second",
        principle: "p2",
        publishedAt: "2026-02-01",
      },
      {
        subject: "informatics",
        slug: "first",
        title: "First",
        principle: "p1",
        publishedAt: "2026-01-01",
      },
    ];

    const derived = deriveTopicsFromEditorials(editorials);
    const first = derived.find((t) => t.editorialSlug === "first");
    const second = derived.find((t) => t.editorialSlug === "second");

    expect(first?.order).toBe(0);
    expect(second?.order).toBe(1);
  });

  it("returns an empty array for no editorials", () => {
    expect(deriveTopicsFromEditorials([])).toEqual([]);
  });
});
