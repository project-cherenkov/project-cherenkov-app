import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// "#content" is a build-time alias to Velite's output, which Vite doesn't
// resolve. Load the generated JSON (run `pnpm generate` first, as CI does
// before `pnpm build`) so these tests run against the real content files.
vi.mock("#content", () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(path.resolve(process.cwd(), ".velite", name), "utf8"));
  return { editorials: read("editorials.json"), materials: read("materials.json") };
});

import {
  filterEditorials,
  getAllEditorials,
  getAllMaterials,
  getArchiveFacets,
  getEditorial,
  isArchivedEditorial,
} from "@/lib/content";
import { isIndexableEditorial } from "@/lib/seo";

const FIXTURE = ["informatics", "programmable-scene-fixture"] as const;

describe("published / archived visibility", () => {
  it("the programmable scene fixture is archived", () => {
    expect(isArchivedEditorial(...FIXTURE)).toBe(true);
  });

  it("public helpers never return archived editorials", () => {
    expect(getAllEditorials().every((e) => e.status === "published")).toBe(true);
    expect(getEditorial(...FIXTURE)).toBeUndefined();
    expect(filterEditorials({}).some((e) => e.slug === FIXTURE[1])).toBe(false);
  });

  it("includeArchived (editors only) returns them", () => {
    expect(getAllEditorials({ includeArchived: true }).some((e) => e.slug === FIXTURE[1])).toBe(true);
    expect(getEditorial(...FIXTURE, { includeArchived: true })?.status).toBe("archived");
    expect(filterEditorials({}, { includeArchived: true }).length).toBeGreaterThan(
      filterEditorials({}).length,
    );
  });

  it("archive facets follow the same visibility", () => {
    const fixture = getEditorial(...FIXTURE, { includeArchived: true })!;
    const publicFacets = getArchiveFacets();
    const editorFacets = getArchiveFacets({}, { includeArchived: true });
    // The fixture's principle is its own; it only shows up for editors.
    expect(publicFacets.principles).not.toContain(fixture.principle);
    expect(editorFacets.principles).toContain(fixture.principle);
  });

  it("public material list is published-only", () => {
    expect(getAllMaterials().every((m) => m.status === "published")).toBe(true);
  });

  it("an archived editorial is never indexable, whatever its author", () => {
    expect(isIndexableEditorial({ tags: [], author: "Renee", status: "archived" })).toBe(false);
    expect(isIndexableEditorial({ tags: [], author: "Renee", status: "published" })).toBe(true);
  });

  it("the published editorials are authored by Renee", () => {
    for (const e of getAllEditorials()) expect(e.author).toBe("Renee");
  });
});
