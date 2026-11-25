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

// Materials: the same round-trip guard as editorials. Also proves the
// syllabus-topic <select> options accept every real material's `topic`.
describe("keystatic.config — materials round-trip against real content", () => {
  it.each(["astronomyMaterials", "physicsMaterials", "informaticsMaterials"] as const)(
    "%s reads every real material without throwing",
    async (name) => {
      const collection = reader.collections[name];
      const slugs = await collection.list();
      const entries = await Promise.all(slugs.map((slug) => collection.readOrThrow(slug)));
      expect(entries).toHaveLength(slugs.length);
    },
  );

  it("reads the new optional syllabusTopic on an editorial", async () => {
    const entry = await reader.collections.informaticsEditorials.readOrThrow("binary-search-on-answer");
    expect(entry.syllabusTopic).toBe("binary-search");
  });
});

// Quiz questions: every real file must open in Keystatic's own reader. That
// also proves each question's `topic` is one of the planner-topic <select>
// options (the reader rejects a value outside the options), so a typo'd topic
// cannot hide in a hand-edited file.
describe("keystatic.config — quiz questions round-trip against real content", () => {
  it.each([
    ["astronomyQuestions", "astronomy"],
    ["physicsQuestions", "physics"],
    ["informaticsQuestions", "informatics"],
  ] as const)("%s reads every real question without throwing", async (name, subject) => {
    const collection = reader.collections[name];
    const keys = await collection.list();
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const entry = await collection.readOrThrow(key);
      expect(entry.questionId, key).toBe(key);
      expect(key.startsWith(`${subject}.`), key).toBe(true);
    }
  });

  it("stores each subject's questions under content/quiz/<subject>", () => {
    for (const subject of ["astronomy", "physics", "informatics"] as const) {
      const name = `${subject}Questions` as const;
      expect(keystaticConfig.collections?.[name]?.path).toBe(`content/quiz/${subject}/*`);
    }
  });

  // The real reader, against files in each of the four new-format layouts and
  // the legacy layout, for every subject collection (a synthetic content root).
  it.each(["astronomy", "physics", "informatics"] as const)(
    "%s: the real reader parses legacy and all four new-format files",
    async (subject) => {
      const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const { createReader } = await import("@keystatic/core/reader");
      const topic = ({ astronomy: "celestial-mechanics", physics: "vectors", informatics: "binary-search" } as const)[subject];
      const root = mkdtempSync(join(tmpdir(), "ks-"));
      try {
        const dir = join(root, "content/quiz", subject);
        mkdirSync(dir, { recursive: true });
        const head = (n: number, type?: string) =>
          `questionId: ${subject}.${topic}.basic.${n}\ntopic: ${topic}\ndifficulty: basic\nstatus: draft\narchived: false\n${type ? `questionType: ${type}\n` : ""}prompt: "P"\n`;
        const tail = '\nexplanation: "E"\nauthor: "A"\nsource: "original"\n';
        const files: Record<number, string> = {
          1: head(1).replace(/author.*\n/, "") + 'choices:\n  - text: "a"\n    correct: false\n  - text: "b"\n    correct: true\nexplanation: "E"\n', // legacy
          2: head(2, "single_choice") + 'choices:\n  - text: "a"\n    correct: true\n  - text: "b"\n    correct: false' + tail,
          3: head(3, "multiple_select") + 'choices:\n  - text: "a"\n    correct: true\n  - text: "b"\n    correct: true\n  - text: "c"\n    correct: false' + tail,
          4: head(4, "true_false_set") + 'statements:\n  - text: "s1"\n    isTrue: true\n  - text: "s2"\n    isTrue: false\n  - text: "s3"\n    isTrue: true' + tail,
          5: head(5, "numeric_response") + "numericAnswer:\n  value: 2.35\n  tolerance: 0.01\n  unit: \"au\"" + tail,
        };
        for (const [n, text] of Object.entries(files)) writeFileSync(join(dir, `${subject}.${topic}.basic.${n}.yaml`), text);
        const collection = createReader(root, keystaticConfig).collections[`${subject}Questions` as const];
        const read = async (n: number) => collection.readOrThrow(`${subject}.${topic}.basic.${n}`);
        expect((await read(1)).choices).toHaveLength(2); // legacy file untouched by the new schema
        expect((await read(3)).choices.filter((c) => c.correct)).toHaveLength(2);
        expect((await read(4)).statements.map((s) => s.isTrue)).toEqual([true, false, true]);
        expect((await read(5)).numericAnswer).toEqual({ value: 2.35, tolerance: 0.01, unit: "au" });
        expect((await read(5)).questionType).toBe("numeric_response");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("offers exactly the four contract question types, defaulting to single_choice", () => {
    for (const subject of ["astronomy", "physics", "informatics"] as const) {
      const schema = keystaticConfig.collections?.[`${subject}Questions` as const]?.schema as Record<string, any>;
      expect(schema.questionType.options.map((o: { value: string }) => o.value)).toEqual([
        "single_choice", "multiple_select", "true_false_set", "numeric_response",
      ]);
      expect(schema.questionType.defaultValue()).toBe("single_choice");
      expect(Object.keys(schema)).toEqual(expect.arrayContaining(["choices", "statements", "numericAnswer", "author", "source"]));
    }
  });
});
