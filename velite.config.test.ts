import { s } from "velite";
import { describe, expect, it } from "vitest";
import { vizEngines, MIN_PUBLISHED_YEAR } from "./velite.config";

// Schema-level check for SCENE-002's only change to this file (the
// vizEngines tuple) — a full `pnpm generate` build-time check against a
// composed-scene fixture file was also run manually during implementation
// (see the implementation report) and passed; this test keeps that
// coverage exercised on every run without needing a committed fixture MDX
// file just for the test.
// Schema-level check for SCENE-002's only change to this file (the
// vizEngines tuple) — a full `pnpm generate` build-time check against a
// composed-scene fixture file was also run manually during implementation
// (see the implementation report) and passed; this test keeps that
// coverage exercised on every run without needing a committed fixture MDX
// file just for the test.
//
// PROG-004 added "programmable-scene" to the same tuple, the same way.
describe("velite.config vizEngines", () => {
  const schema = s.enum(vizEngines);

  it("accepts composed-scene", () => {
    expect(schema.safeParse("composed-scene").success).toBe(true);
  });

  it("accepts programmable-scene", () => {
    expect(schema.safeParse("programmable-scene").success).toBe(true);
  });

  it("still accepts all four pre-existing values, unchanged", () => {
    for (const value of ["graph-array-stepper", "trajectory-sandbox", "orbital-sandbox", "none"]) {
      expect(schema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects a value outside the enum", () => {
    expect(schema.safeParse("not-a-real-engine").success).toBe(false);
  });
});

// F-04: two junk editorials (content/editorials/astronomy/dsadas.mdx and
// content/editorials/physics/apaya.mdx, both now deleted) shipped with
// `publishedAt` values in the years 0011 and 0031. This guard turns an
// implausible publishedAt into a build-time failure instead of a silent
// merge. Isolated here the same way the vizEngines tests above isolate
// their sub-schema, since s.path()/s.mdx() need Velite's own file-context
// metadata and can't be exercised via a bare .safeParse() call.
describe("velite.config publishedAt guard (F-04)", () => {
  const publishedAtSchema = s
    .isodate()
    .refine((value) => new Date(value).getUTCFullYear() >= MIN_PUBLISHED_YEAR, (value) => ({
      message: `publishedAt "${value}" is before ${MIN_PUBLISHED_YEAR} — looks like placeholder/test data, not a real publish date.`,
    }));

  it("rejects the exact junk publishedAt values previously shipped in the now-deleted dsadas.mdx / apaya.mdx", () => {
    expect(publishedAtSchema.safeParse("0011-01-01").success).toBe(false);
    expect(publishedAtSchema.safeParse("0031-01-01").success).toBe(false);
  });

  it(`rejects any date before ${MIN_PUBLISHED_YEAR}`, () => {
    expect(publishedAtSchema.safeParse("2019-12-31").success).toBe(false);
  });

  it(`accepts a date from ${MIN_PUBLISHED_YEAR} onward`, () => {
    expect(publishedAtSchema.safeParse(`${MIN_PUBLISHED_YEAR}-01-01`).success).toBe(true);
    expect(publishedAtSchema.safeParse("2024-06-15").success).toBe(true);
  });

  it("still throws for a value that isn't a valid ISO date at all (pre-existing s.isodate() behavior — it throws rather than a graceful safeParse failure; unaffected by this guard, which only adds a .refine() after it)", () => {
    expect(() => publishedAtSchema.safeParse("not-a-date")).toThrow();
  });
});

// Confirms the four real editorials left after F-04's cleanup all clear
// the new guard — reads their actual frontmatter directly (via
// gray-matter, already a project dependency) rather than depending on a
// full `pnpm generate` run.
describe("velite.config publishedAt guard — real content", () => {
  it("every real editorial's publishedAt is at or after MIN_PUBLISHED_YEAR", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const matter = (await import("gray-matter")).default;

    const root = join(__dirname, "content/editorials");
    const files = readdirSync(root, { recursive: true, encoding: "utf-8" }).filter((entry) =>
      entry.toString().endsWith(".mdx"),
    );

    expect(files.length).toBe(4);
    for (const file of files) {
      const raw = readFileSync(join(root, file.toString()), "utf-8");
      const { data } = matter(raw);
      const year = new Date(data.publishedAt).getUTCFullYear();
      expect(year).toBeGreaterThanOrEqual(MIN_PUBLISHED_YEAR);
    }
  });
});
