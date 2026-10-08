import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import { SUBJECTS } from "./lib/subjects";
import { getTopicLocation } from "./lib/syllabus";

// Materials and editorials point at syllabus topics by id. A typo would not
// fail the Velite build — the page would just silently detach from the
// syllabus — so this is the guard. (Keystatic's topic <select> makes typos
// unlikely through the CMS; hand-edited MDX is what this catches.)
const root = process.cwd();

function readAll(kind: "materials" | "editorials") {
  const files: { subject: string; slug: string; data: Record<string, unknown> }[] = [];
  for (const subject of SUBJECTS) {
    let names: string[] = [];
    try {
      names = readdirSync(join(root, "content", kind, subject)).filter((f) => f.endsWith(".mdx"));
    } catch {
      continue; // no content for this subject yet
    }
    for (const name of names) {
      const { data } = matter(readFileSync(join(root, "content", kind, subject, name), "utf-8"));
      files.push({ subject, slug: name.replace(/\.mdx$/, ""), data });
    }
  }
  return files;
}

describe("materials ↔ syllabus integrity", () => {
  const materials = readAll("materials");

  it("ships at least one material (the starter), so the flow is demonstrable", () => {
    expect(materials.length).toBeGreaterThan(0);
  });

  it("every material's frontmatter subject matches its folder", () => {
    for (const m of materials) expect(m.data.subject, `${m.subject}/${m.slug}`).toBe(m.subject);
  });

  it("every material points at a topic that exists in its subject's syllabus", () => {
    for (const m of materials) {
      expect(getTopicLocation(m.subject, String(m.data.topic)), `${m.subject}/${m.slug} → ${m.data.topic}`).toBeDefined();
    }
  });

  it("at most one material per topic", () => {
    const seen = new Set<string>();
    for (const m of materials) {
      const key = `${m.subject}:${m.data.topic}`;
      expect(seen.has(key), `two materials claim ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

describe("editorials ↔ syllabus integrity", () => {
  it("any syllabusTopic set on an editorial exists in its subject's syllabus", () => {
    for (const e of readAll("editorials")) {
      const topic = e.data.syllabusTopic;
      if (!topic) continue; // optional; Keystatic writes "" for none
      expect(getTopicLocation(e.subject, String(topic)), `${e.subject}/${e.slug} → ${topic}`).toBeDefined();
    }
  });
});

// --- Docs -----------------------------------------------------------------------
// Docs are one MDX file per page per language under content/docs/<locale>/.
// English is the source of truth; these checks keep the set coherent without
// needing a Velite build (frontmatter is read straight from the files).
describe("docs integrity", () => {
  const docsRoot = join(root, "content", "docs");
  const locales = readdirSync(docsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  function readDocs(locale: string) {
    return readdirSync(join(docsRoot, locale))
      .filter((name) => name.endsWith(".mdx"))
      .map((name) => {
        const raw = readFileSync(join(docsRoot, locale, name), "utf-8");
        const parsed = matter(raw);
        return { locale, slug: name.replace(/\.mdx$/, ""), data: parsed.data, body: parsed.content };
      });
  }

  const english = readDocs("en");
  const englishSlugs = new Set(english.map((doc) => doc.slug));
  const sections = ["start", "reading", "contributing"];

  it("ships English documentation (the source language)", () => {
    expect(english.length).toBeGreaterThan(0);
  });

  it("only uses locale folders the site actually serves", () => {
    for (const locale of locales) expect(["en", "id"], locale).toContain(locale);
  });

  it("every translation has an English original (so it can't create an orphan page)", () => {
    for (const locale of locales.filter((l) => l !== "en")) {
      for (const doc of readDocs(locale)) {
        expect(englishSlugs.has(doc.slug), `${locale}/${doc.slug} has no English original`).toBe(true);
      }
    }
  });

  it("frontmatter is complete and within the limits the pages and meta tags assume", () => {
    for (const locale of locales) {
      for (const doc of readDocs(locale)) {
        const where = `${locale}/${doc.slug}`;
        expect(typeof doc.data.title, `${where} title`).toBe("string");
        expect(String(doc.data.title).length, `${where} title length`).toBeLessThanOrEqual(100);
        expect(typeof doc.data.description, `${where} description`).toBe("string");
        expect(String(doc.data.description).length, `${where} description length`).toBeLessThanOrEqual(200);
        expect(sections, `${where} section`).toContain(doc.data.section);
      }
    }
  });

  it("slugs are URL-safe", () => {
    for (const doc of english) expect(doc.slug, doc.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("no doc body starts its own <h1> (the page title is the h1)", () => {
    for (const doc of english) {
      const withoutFences = doc.body.replace(/```[\s\S]*?```/g, "");
      expect(/^# /m.test(withoutFences), `${doc.slug} has a top-level heading`).toBe(false);
    }
  });

  it("every internal /docs/... link resolves to a real page", () => {
    for (const locale of locales) {
      for (const doc of readDocs(locale)) {
        for (const match of doc.body.matchAll(/\]\((\/docs\/[^)#\s]+)/g)) {
          const slug = match[1]!.replace("/docs/", "");
          expect(englishSlugs.has(slug), `${locale}/${doc.slug} links to missing /docs/${slug}`).toBe(true);
        }
      }
    }
  });
});
