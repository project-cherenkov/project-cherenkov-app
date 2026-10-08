import { afterEach, describe, expect, it, vi } from "vitest";

import {
  articleJsonLd,
  breadcrumbJsonLd,
  buildPageMetadata,
  isIndexableEditorial,
  isIndexingEnabled,
  languageAlternates,
  localizedPath,
  localizedUrl,
  robotsFor,
  serializeJsonLd,
  truncate,
} from "./seo";

describe("localizedPath / localizedUrl", () => {
  it("prefixes the locale, treating '/' as the locale root", () => {
    expect(localizedPath("id", "/")).toBe("/id");
    expect(localizedPath("en", "/archive")).toBe("/en/archive");
    expect(localizedPath("en", "archive")).toBe("/en/archive");
  });

  it("builds absolute URLs from the site origin", () => {
    expect(localizedUrl("id", "/docs")).toMatch(/^https?:\/\/[^/]+\/id\/docs$/);
  });
});

describe("languageAlternates", () => {
  it("lists every locale plus x-default pointing at the default locale", () => {
    const map = languageAlternates("/archive");
    expect(Object.keys(map).sort()).toEqual(["en", "id", "x-default"]);
    expect(map["x-default"]).toBe(map["id"]);
    expect(map["en"]).toMatch(/\/en\/archive$/);
  });

  it("only advertises the locales a page actually exists in", () => {
    const map = languageAlternates("/docs/x", ["en"]);
    expect(Object.keys(map).sort()).toEqual(["en", "x-default"]);
    expect(map["x-default"]).toBe(map["en"]);
  });
});

describe("indexing switch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless NEXT_PUBLIC_ALLOW_INDEXING is explicitly 1 or true", () => {
    expect(isIndexingEnabled({})).toBe(false);
    expect(isIndexingEnabled({ NEXT_PUBLIC_ALLOW_INDEXING: "0" })).toBe(false);
    expect(isIndexingEnabled({ NEXT_PUBLIC_ALLOW_INDEXING: "" })).toBe(false);
    expect(isIndexingEnabled({ NEXT_PUBLIC_ALLOW_INDEXING: "1" })).toBe(true);
    expect(isIndexingEnabled({ NEXT_PUBLIC_ALLOW_INDEXING: " TRUE " })).toBe(true);
  });

  it("noindex,nofollow by default", () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "");
    expect(robotsFor()).toEqual({ index: false, follow: false });
  });

  it("indexable when enabled, but `noindex` always wins", () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "1");
    expect(robotsFor()).toEqual({ index: true, follow: true });
    expect(robotsFor({ noindex: true })).toEqual({ index: false, follow: false });
  });
});

describe("truncate", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(truncate("a  b\n c")).toBe("a b c");
  });

  it("cuts on a word boundary and adds an ellipsis", () => {
    const out = truncate("word ".repeat(60), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });
});

describe("buildPageMetadata", () => {
  const base = { locale: "id", path: "/archive", title: "Arsip", description: "Deskripsi", siteName: "Cherenkov" };

  it("sets a self-referencing canonical, hreflang alternates and OG/Twitter fields", () => {
    const meta = buildPageMetadata(base);
    expect(meta.alternates?.canonical).toMatch(/\/id\/archive$/);
    expect(meta.alternates?.languages).toHaveProperty("en");
    expect(meta.alternates?.languages).toHaveProperty("x-default");
    expect(meta.openGraph).toMatchObject({ locale: "id_ID", alternateLocale: ["en_US"], title: "Arsip — Cherenkov" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("names the social image explicitly (a page's openGraph replaces its parent's)", () => {
    const meta = buildPageMetadata(base);
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({ url: expect.stringMatching(/\/id\/opengraph-image$/), width: 1200, height: 630 }),
    ]);
    expect(meta.twitter?.images).toEqual([expect.stringMatching(/\/id\/opengraph-image$/)]);
  });

  it("can canonicalise to a different locale (used for untranslated docs)", () => {
    const meta = buildPageMetadata({ ...base, canonicalLocale: "en", availableLocales: ["en"] });
    expect(meta.alternates?.canonical).toMatch(/\/en\/archive$/);
    expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(["en", "x-default"]);
  });

  it("uses an absolute title when asked", () => {
    expect(buildPageMetadata({ ...base, absoluteTitle: true }).title).toEqual({ absolute: "Arsip" });
  });

  it("includes article fields only for article pages", () => {
    const article = buildPageMetadata({
      ...base,
      ogType: "article",
      article: { publishedTime: "2026-01-01", authors: ["A"], tags: ["t"], section: "physics" },
    });
    expect(article.openGraph).toMatchObject({ type: "article", publishedTime: "2026-01-01", section: "physics" });
    expect(buildPageMetadata(base).openGraph).not.toHaveProperty("publishedTime");
  });
});

describe("JSON-LD", () => {
  it("escapes characters that could break out of a <script> tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });

  it("numbers breadcrumb items from 1 and omits the URL on the current page", () => {
    const ld = breadcrumbJsonLd("en", [{ name: "Docs", path: "/docs" }, { name: "Page" }]) as {
      itemListElement: { position: number; item?: string }[];
    };
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[0]?.item).toMatch(/\/en\/docs$/);
    expect(ld.itemListElement[1]).not.toHaveProperty("item");
  });

  it("builds an Article with author, dates and keywords", () => {
    const ld = articleJsonLd({
      locale: "en",
      path: "/archive/physics/x",
      headline: "H",
      description: "D",
      author: "Ada",
      publishedAt: "2026-02-03",
      keywords: ["a", "b"],
      section: "physics",
      siteName: "Cherenkov",
    });
    expect(ld).toMatchObject({
      "@type": "Article",
      headline: "H",
      author: { "@type": "Person", name: "Ada" },
      datePublished: "2026-02-03",
      dateModified: "2026-02-03",
      keywords: "a, b",
      articleSection: "physics",
    });
  });
});

describe("isIndexableEditorial", () => {
  it("excludes implementation fixtures and placeholder-author stubs", () => {
    expect(isIndexableEditorial({ tags: ["fixture"], author: "Ada" })).toBe(false);
    expect(isIndexableEditorial({ tags: [], author: "PLACEHOLDER Author Name" })).toBe(false);
    expect(isIndexableEditorial({ tags: ["binary-search"], author: "Ada" })).toBe(true);
  });
});
