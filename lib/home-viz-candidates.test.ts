import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// "#content" is a build-time alias to Velite's output, which Vite does not
// resolve. Load the generated JSON (run `pnpm generate` first, as CI does), so
// these tests run against the real content files.
vi.mock("#content", () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(path.resolve(process.cwd(), ".velite", name), "utf8"));
  return {
    editorials: read("editorials.json"),
    materials: read("materials.json"),
    editorialTranslations: read("editorialTranslations.json"),
    materialTranslations: read("materialTranslations.json"),
  };
});
import { getAllEditorials } from "@/lib/content";
import { getHomeVizCandidates } from "./home-viz-candidates";
import { DEFAULT_HOME_VIZ_KEYS, isHomeVizKey } from "./home-viz-picks";

describe("getHomeVizCandidates", () => {
  const candidates = getHomeVizCandidates("en");

  it("lists only published editorials that have a visualization", () => {
    const published = new Set(getAllEditorials().map((e) => `${e.subject}/${e.slug}`));
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(published.has(candidate.key)).toBe(true);
      expect(candidate.vizConfig.discriminant).not.toBe("none");
    }
  });

  it("has unique, well-formed keys", () => {
    const keys = candidates.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every(isHomeVizKey)).toBe(true);
  });

  it("includes every default pick, so a new visitor sees the intended three", () => {
    const keys = new Set(candidates.map((c) => c.key));
    for (const key of DEFAULT_HOME_VIZ_KEYS) expect(keys.has(key)).toBe(true);
  });

  it("excludes drafts", () => {
    expect(candidates.some((c) => c.key === "informatics/programmable-scene-fixture")).toBe(false);
  });

  it("marks the language of the title and of the description", () => {
    for (const candidate of candidates) {
      expect(candidate.titleLang).toMatch(/^[a-z]{2}/);
      expect(candidate.descriptionLang).toMatch(/^[a-z]{2}/);
    }
  });

  it("gives the Indonesian page the same candidates", () => {
    expect(getHomeVizCandidates("id").map((c) => c.key)).toEqual(candidates.map((c) => c.key));
  });
});
