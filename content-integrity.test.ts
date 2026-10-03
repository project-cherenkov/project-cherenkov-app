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
