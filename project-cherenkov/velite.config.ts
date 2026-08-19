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
const vizEngines = [
  "graph-array-stepper",
  "trajectory-sandbox",
  "orbital-sandbox",
  "none",
] as const;

const subjects = ["informatics", "physics", "astronomy"] as const;

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
      vizEngine: s.enum(vizEngines),
      vizConfig: s.record(s.string(), s.unknown()).default({}),
      publishedAt: s.isodate(),
      author: s.string(),
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

export default defineConfig({
  root: "content",
  collections: { editorials },
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
