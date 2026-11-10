import { describe, expect, it } from "vitest";

import { resolveUpdates, type UpdateLike } from "./updates-core";

const make = (over: Partial<UpdateLike> & { slug: string }): UpdateLike => ({
  title: over.slug,
  summary: "s",
  locale: "en",
  isOriginal: true,
  ...over,
});

const original = make({ slug: "a", date: "2026-11-10", type: "syllabus" });
const translation = make({ slug: "a", locale: "id", isOriginal: false, title: "judul" });

describe("resolveUpdates", () => {
  it("shows the original, flagged as a fallback, when the visitor's language has no version", () => {
    const [entry] = resolveUpdates([original], "id");
    expect(entry!.isFallback).toBe(true);
    expect(entry!.update.title).toBe("a");
    expect(entry!.locales).toEqual(["en"]);
  });

  it("shows no fallback for the original's own language", () => {
    expect(resolveUpdates([original], "en")[0]!.isFallback).toBe(false);
  });

  it("the notice disappears once a translation exists, with no flag to change", () => {
    const [entry] = resolveUpdates([original, translation], "id");
    expect(entry!.isFallback).toBe(false);
    expect(entry!.update.title).toBe("judul");
    expect(entry!.locales.sort()).toEqual(["en", "id"]);
    // The other language still gets the original, unflagged.
    expect(resolveUpdates([original, translation], "en")[0]!.isFallback).toBe(false);
  });

  it("an original written in Indonesian is the fallback for English", () => {
    const idOriginal = make({ slug: "b", locale: "id", date: "2026-11-09", type: "fix" });
    expect(resolveUpdates([idOriginal], "en")[0]!.isFallback).toBe(true);
    expect(resolveUpdates([idOriginal], "id")[0]!.isFallback).toBe(false);
  });

  it("takes date and type from the original, never a translation", () => {
    const [entry] = resolveUpdates(
      [original, { ...translation, date: "1999-01-01", type: "fix" }],
      "id",
    );
    expect(entry).toMatchObject({ date: "2026-11-10", type: "syllabus" });
  });

  it("sorts newest first and skips an orphan translation", () => {
    const older = make({ slug: "z", date: "2026-01-01", type: "notice" });
    const orphan = make({ slug: "orphan", locale: "id", isOriginal: false });
    expect(resolveUpdates([older, orphan, original], "en").map((e) => e.update.slug)).toEqual(["a", "z"]);
  });
});
