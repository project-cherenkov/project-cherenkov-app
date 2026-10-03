import { defineCollection, defineConfig, s } from "velite";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Mirrors the frontmatter schema from the build spec, Section 6.
//
// OPEN QUESTION (spec §12): `principle` / `errorType` are left as free
// strings on purpose — the taxonomy isn't finalized. Don't tighten these to
// z.enum([...]) until there are enough real editorials to see the real
// vocabulary. When that happens, this is the only file that needs to change.
//
// NOTE — flagging, not guessing: spec §1 says "every published editorial
// ships with a working interactive visualization... there is no such thing
// as an editorial page without one," but §6's own schema lists "none" as a
// valid `vizEngine`. Those two lines conflict. This schema keeps "none" per
// §6's literal type (so nothing here silently forecloses the option), but
// the archive/editorial UI treats it as a content error rather than a
// legitimate state — see `lib/content.ts`. Flag this back to confirm which
// rule wins before Phase 1 ships for real.
// Exported (only change beyond adding "composed-scene" itself) so
// velite.config.test.ts can assert against the schema directly rather than
// only via a full `pnpm generate` build-time check.
export const vizEngines = [
  "graph-array-stepper",
  "trajectory-sandbox",
  "orbital-sandbox",
  "composed-scene",
  "programmable-scene",
  "none",
] as const;

const subjects = ["informatics", "physics", "astronomy"] as const;

// F-04 guard: reject placeholder/test `publishedAt` values (the two junk
// editorials removed in this same change had `publishedAt` values in the
// years 0011 and 0031) with a hard build failure rather than a silent
// merge. 2020 predates this project by a comfortable margin, so any real
// editorial will clear it easily.
export const MIN_PUBLISHED_YEAR = 2020;

const editorials = defineCollection({
  name: "Editorial",
  pattern: "editorials/**/*.mdx",
  schema: s
    .object({
      title: s.string().max(120),
      subject: s.enum(subjects),
      hook: s.string().max(280),
      tags: s.array(s.string()),
      principle: s.string(), // open string — see note above
      errorType: s.string().optional(), // open string — see note above
      vizConfig: s
        .object({
          discriminant: s.enum(vizEngines),
          value: s.record(s.string(), s.unknown()).default({}),
        })
        .default({ discriminant: "none", value: {} }),
      publishedAt: s
        .isodate()
        .refine((value) => new Date(value).getUTCFullYear() >= MIN_PUBLISHED_YEAR, (value) => ({
          message: `publishedAt "${value}" is before ${MIN_PUBLISHED_YEAR} — looks like placeholder/test data, not a real publish date.`,
        })),
      author: s.string(),
      // Optional link into the syllabus (a topic id from lib/syllabus). Empty
      // string is what Keystatic writes for "none", so normalise it away.
      syllabusTopic: s
        .string()
        .optional()
        .transform((value) => value || undefined),
      // Full proof + prose body, compiled to a renderable MDX component.
      body: s.mdx(),
      // Derived from the file path (content/editorials/<subject>/<slug>.mdx),
      // not from frontmatter — keeps the URL and the file location in sync.
      slug: s.path(),
    })
    .transform((data) => ({
      ...data,
      // content/editorials/physics/foo.mdx -> "foo"
      slug: data.slug.split("/").pop() as string,
      url: `/archive/${data.subject}/${data.slug.split("/").pop()}`,
    })),
});

// Materials: unsigned, topic-by-topic breakdowns of the syllabus. Deliberately
// a separate collection from editorials — no author, no principle/errorType
// (the archive's index), and no required visualization — because they are
// indexed by syllabus topic, not by principle. `topic` must be a topic id from
// lib/syllabus for the same `subject`; content-integrity.test.ts enforces it.
const materials = defineCollection({
  name: "Material",
  pattern: "materials/**/*.mdx",
  schema: s
    .object({
      title: s.string().max(120),
      subject: s.enum(subjects),
      topic: s.string(),
      summary: s.string().max(280),
      body: s.mdx(),
      // Derived from the file path, same as editorials.
      slug: s.path(),
    })
    .transform((data) => {
      const slug = data.slug.split("/").pop() as string;
      return { ...data, slug, url: `/materials/${data.subject}/${slug}` };
    }),
});

export default defineConfig({
  root: "content",
  collections: { editorials, materials },
  mdx: {
    // $inline$ and $$display$$ math in editorial prose compiles to static
    // KaTeX HTML at build time — no client JS, no reflow (spec §3's reason
    // for choosing KaTeX in the first place). The CSS that markup needs is
    // imported per-page in app/[locale]/archive/[subject]/[slug]/page.tsx,
    // not globally, per the code-splitting rule in spec §8.
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});
