import { describe, expect, it } from "vitest";
import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "./keystatic.config";

// CH-01 (architect audit round 1): keystatic.config.ts's `vizConfig` field
// schema previously diverged from velite.config.ts's actual schema and
// from every real content/editorials/**/*.mdx file's on-disk shape,
// causing Keystatic's reader to throw ("Key on object value 'discriminant'
// is not allowed") on every real hand-authored editorial — making the CMS
// unable to open any of them. This test constructs a real reader against
// the repo's own real content (no fixtures needed — mirrors lib/team.ts's
// `createReader` usage) and asserts it can read every real, hand-authored
// editorial without throwing. This is the automated check the removed
// "CMS-007 round-trip check" comment claimed already existed but didn't.
const reader = createReader(process.cwd(), keystaticConfig);

// KNOWN, DOCUMENTED LIMITATION (unchanged by the CH-01 fix, not a new gap
// it introduced): content/editorials/informatics/programmable-scene-fixture.mdx
// uses `vizConfig.discriminant: programmable-scene`, whose `value` is an
// arbitrarily deep, recursive ProgramNode tree (components/viz/programmable-scene/types.ts).
// keystatic.config.ts's vizConfigValueObject() — same as before this fix —
// cannot express that shape as a fixed set of Keystatic fields; this is the
// same limitation keystatic.config.ts's own PROG-004 comment already
// documents for programmable-scene's write path ("adding a second,
// structurally different config shape ... is a large enough change to
// warrant its own review"). CH-01's fix targets the three real,
// hand-authored, scalar-engine editorials this schema IS meant to support
// (graph-array-stepper, trajectory-sandbox, orbital-sandbox) — extending
// Keystatic's field schema to also cover programmable-scene's recursive
// program shape is out of this fix's scope and is flagged here, not
// silently skipped.
const KNOWN_UNREPRESENTABLE_SLUGS: Record<string, string[]> = {
  informaticsEditorials: ["programmable-scene-fixture"],
};

async function readAllExceptKnownLimitations(
  collectionName: "astronomyEditorials" | "physicsEditorials" | "informaticsEditorials",
) {
  const collection = reader.collections[collectionName];
  const slugs = await collection.list();
  const skip = new Set(KNOWN_UNREPRESENTABLE_SLUGS[collectionName] ?? []);
  const readableSlugs = slugs.filter((slug) => !skip.has(slug));
  const entries = await Promise.all(readableSlugs.map((slug) => collection.readOrThrow(slug)));
  return { slugs, readableSlugs, entries };
}

describe("keystatic.config — reader round-trip against real content", () => {
  it("reads every real, hand-authored astronomy editorial without throwing", async () => {
    const { readableSlugs, entries } = await readAllExceptKnownLimitations("astronomyEditorials");
    expect(readableSlugs.length).toBeGreaterThan(0);
    expect(entries).toHaveLength(readableSlugs.length);
  });

  it("reads every real, hand-authored physics editorial without throwing", async () => {
    const { readableSlugs, entries } = await readAllExceptKnownLimitations("physicsEditorials");
    expect(readableSlugs.length).toBeGreaterThan(0);
    expect(entries).toHaveLength(readableSlugs.length);
  });

  it("reads every real, hand-authored informatics editorial without throwing", async () => {
    const { slugs, readableSlugs, entries } = await readAllExceptKnownLimitations("informaticsEditorials");
    // Confirms the known-limitation fixture is still actually present and
    // still actually unrepresentable — so this exclusion can't silently
    // mask a real regression once that fixture starts round-tripping too
    // (see the file-level comment above).
    expect(slugs).toContain("programmable-scene-fixture");
    expect(readableSlugs.length).toBeGreaterThan(0);
    expect(entries).toHaveLength(readableSlugs.length);
  });

  it("documents (rather than silently passing on) the known programmable-scene limitation", async () => {
    await expect(
      reader.collections.informaticsEditorials.readOrThrow("programmable-scene-fixture"),
    ).rejects.toThrow(/vizConfig\.value/);
  });
});
