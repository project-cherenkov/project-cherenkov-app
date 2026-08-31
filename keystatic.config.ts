import { config, collection, singleton, fields } from "@keystatic/core";

// Mirrors velite.config.ts field-for-field (spec §11 CMS-002). If either
// schema changes, the other must change with it — there is no automated
// sync between them (flagged as a MEDIUM risk in the architect spec, §9).
//
// This file's shape was arrived at empirically, via the CMS-007 round-trip
// check (reading every real content/editorials/**/*.mdx file through
// Keystatic's own reader, not just eyeballing the API), against the
// installed @keystatic/core 0.6.8. Two of the architect spec's named
// design decisions did not survive that check and were replaced — see the
// DEVIATION comments at vizConfigObject() and its pointers field below for
// exactly what changed and why. Everything else (decisions #2–#5) matches
// the spec as written.
//
//   2. Three separate collections (one per subject), each hardcoded to its
//      own content/editorials/<subject>/* path, instead of one collection
//      with subject as an editable field — makes a folder/frontmatter
//      subject mismatch structurally impossible. `subject` IS still
//      declared as a field (see BUGFIX comment on editorialSchema below,
//      also found via the round-trip check) but as a select with exactly
//      one fixed option per collection, so it's present-but-unchangeable.
//   3. slug is an explicit author-set field, not auto-derived from title —
//      Velite derives its slug from the filename, and retitling a published
//      piece must never silently change its URL.
//   4. principle / errorType stay free-text, not fields.select — the
//      taxonomy is still an open question (velite.config.ts's own comment).
//   5. vizEngine's select includes "none" as a legal value, matching
//      velite.config.ts today, even though it is flagged there as
//      conflicting with spec §1. Not this task's call to resolve.

// Superset object covering every field used by any of the three viz
// engines (spec §7's table), all optional. Each real file only populates
// the subset relevant to its own vizEngine.
//
// DEVIATION from spec §3 decision #1 ("vizConfig uses fields.conditional —
// one typed sub-schema per engine — so a mismatched vizEngine/vizConfig
// pairing is rejected at authoring time"). Found via the CMS-007
// round-trip check, not assumed:
//
//   fields.conditional() in @keystatic/core 0.6.8 serializes its value on
//   disk as `{ discriminant: <value>, value: {...} }`, NOT flattened into
//   the parent key. Binding it directly to `vizConfig` requires every
//   file's frontmatter to look like
//   `vizConfig: { discriminant: "trajectory-sandbox", value: { gravity: 9.8 } }`.
//   Every real file instead has the FLAT shape
//   `vizConfig: { physicsType: "projectile", gravity: 9.8, ... }` — which
//   is also exactly what velite.config.ts's
//   `vizConfig: s.record(s.string(), s.unknown())` expects and what all
//   three viz engines' runtime type guards (isTrajectorySandboxConfig,
//   etc.) check against. Using fields.conditional made Keystatic's reader
//   reject every existing editorial: "Must only contain keys 'discriminant'
//   and 'value', not 'physicsType'".
//
//   The spec's own decision table already named the alternative: "Generic
//   fields.object({}) field ... simpler, but defers all validation to
//   production." That is the actual tradeoff shipped here — a single
//   fields.object() containing every engine's fields as optional. The
//   practical loss versus decision #1's original intent: authoring
//   `vizEngine: "orbital-sandbox"` with `gravity` (a trajectory-sandbox
//   field) instead of `eccentricity` set is NOT rejected at authoring
//   time — it still only surfaces as production's existing
//   VizConfigError, exactly as it does today without Keystatic at all. No
//   regression versus the pre-Keystatic status quo; just short of what
//   decision #1 hoped to add.
function vizConfigObject() {
  return fields.object({
    // --- graph-array-stepper ---
    array: fields.array(fields.number({ label: "Value" }), {
      label: "Array",
      itemLabel: (props) => String(props.value ?? ""),
    }),
    steps: fields.array(
      fields.object({
        // DEVIATION, also found via the round-trip check: `pointers` is
        // documented in components/viz/graph-array-stepper/types.ts as an
        // open `Record<string, number>` (arbitrary named indices). Neither
        // fields.json() (doesn't exist in this Keystatic version — checked
        // against the package) nor fields.text() holding raw JSON (tried;
        // the real data is a genuine YAML mapping, not a string, and
        // Keystatic's reader rejects a string where the file has a
        // mapping) round-trips the real data. What DOES work, verified
        // against every real step in
        // content/editorials/informatics/binary-search-on-answer.mdx, is
        // a fixed-key object matching the only keys any current editorial
        // actually uses: lo, hi, mid (binary search's own vocabulary).
        // This is a genuine narrowing of the true open-record type — an
        // editorial using different pointer names (e.g. a two-pointer
        // technique's "left"/"right") will NOT be authorable through this
        // field as it stands. Flagging as a real limitation, not silently
        // covering for it: extending this object with more optional
        // named-pointer fields as new algorithms are added is the
        // pragmatic path within this Keystatic version's real
        // constraints.
        pointers: fields.object({
          lo: fields.integer({ label: "lo" }),
          hi: fields.integer({ label: "hi" }),
          mid: fields.integer({ label: "mid" }),
        }),
        highlight: fields.array(fields.integer({ label: "Index" }), {
          label: "Highlight indices",
          itemLabel: (props) => String(props.value ?? ""),
        }),
        note: fields.text({ label: "Note", multiline: true }),
      }),
      { label: "Steps", itemLabel: (props) => props.fields.note.value || "Step" },
    ),

    // --- trajectory-sandbox ---
    // physicsType's registry has exactly one entry today
    // (components/viz/trajectory-sandbox/index.tsx's own comment); new
    // scenarios add a registry entry there, not a schema change here.
    physicsType: fields.select({
      label: "Physics type",
      options: [{ label: "Projectile", value: "projectile" }],
      defaultValue: "projectile",
    }),
    gravity: fields.number({ label: "Gravity (m/s²)" }),
    initial: fields.object({
      speed: fields.number({ label: "Initial speed (m/s)" }),
      angleDeg: fields.number({ label: "Initial angle (degrees)" }),
    }),
    speedRange: fields.array(fields.number({ label: "Bound" }), {
      label: "Speed slider range [min, max]",
      itemLabel: (props) => String(props.value ?? ""),
    }),
    angleRange: fields.array(fields.number({ label: "Bound" }), {
      label: "Angle slider range [min, max]",
      itemLabel: (props) => String(props.value ?? ""),
    }),

    // --- orbital-sandbox ---
    eccentricity: fields.number({
      label: "Eccentricity",
      description: "0 = circular, must stay below 1 (types.ts comment).",
    }),
    semiMajorAxisPx: fields.number({
      label: "Semi-major axis (px)",
      description: "Schematic visual scale, not AU.",
    }),
    periodSeconds: fields.number({ label: "Orbit period (s)" }),
    massRatio: fields.number({
      label: "Mass ratio (planet/star)",
      description: "Defaults to 0.05 in the engine if left unset.",
    }),
    transitDepth: fields.number({
      label: "Transit depth (fractional flux drop)",
      description: "Defaults to 0.01 in the engine if left unset.",
    }),
    eccentricityRange: fields.array(fields.number({ label: "Bound" }), {
      label: "Eccentricity slider range [min, max]",
      itemLabel: (props) => String(props.value ?? ""),
    }),
    massRatioRange: fields.array(fields.number({ label: "Bound" }), {
      label: "Mass ratio slider range [min, max]",
      itemLabel: (props) => String(props.value ?? ""),
    }),
  });
}

// Shared frontmatter fields, identical across all three subject collections
// except for the hardcoded `subject` literal baked into each collection's
// path/slug, per decision #2.
//
// BUGFIX (found via the CMS-007 round-trip check): every real MDX file has
// a literal `subject: <value>` key, required by velite.config.ts's
// `subject: s.enum(subjects)`. Without `subject` declared here at all,
// Keystatic's reader rejected every existing editorial: "Key on object
// value 'subject' is not allowed". Declaring it as a fields.select() with
// exactly one fixed option per collection lets the schema accept the key
// while still making it structurally uneditable to any other value —
// preserving decision #2's actual goal.
function editorialSchema(subject: "astronomy" | "physics" | "informatics") {
  return {
    subject: fields.select({
      label: "Subject (fixed — matches this collection)",
      options: [{ label: subject, value: subject }],
      defaultValue: subject,
    }),
    title: fields.text({
      label: "Title",
      validation: { isRequired: true, length: { max: 120 } },
    }),
    hook: fields.text({
      label: "Hook",
      multiline: true,
      validation: { isRequired: true, length: { max: 280 } },
    }),
    tags: fields.array(fields.text({ label: "Tag" }), {
      label: "Tags",
      itemLabel: (props) => props.value || "Tag",
    }),
    // Free-text on purpose — see decision #4 above and the identical
    // comment in velite.config.ts. Do not convert to fields.select.
    principle: fields.text({
      label: "Principle",
      description: "Free text — taxonomy not finalized yet (see velite.config.ts).",
      validation: { isRequired: true },
    }),
    errorType: fields.text({
      label: "Error type",
      description: "Free text, optional — see principle's note.",
    }),
    vizEngine: fields.select({
      label: "Visualization engine",
      options: [
        { label: "Graph / array stepper", value: "graph-array-stepper" },
        { label: "Trajectory sandbox", value: "trajectory-sandbox" },
        { label: "Orbital sandbox", value: "orbital-sandbox" },
        { label: "None", value: "none" },
      ],
      defaultValue: "none",
    }),
    vizConfig: vizConfigObject(),
    publishedAt: fields.date({ label: "Published at", validation: { isRequired: true } }),
    author: fields.text({ label: "Author", validation: { isRequired: true } }),
    // Explicit, author-set slug — see decision #3. Velite derives its own
    // slug from the filename, so this must match the MDX filename exactly;
    // Keystatic uses it as the collection's itemSlug source below.
    slug: fields.slug({
      name: {
        label: "Slug",
        description:
          "Sets the MDX filename (content/editorials/<subject>/<slug>.mdx). Not derived from title — retitling a published piece must never change its URL.",
      },
    }),
    content: fields.mdx({
      label: "Body",
      description: "Full proof + prose. $inline$ and $$display$$ math compile to KaTeX at build time.",
    }),
  };
}

export default config({
  storage:
    process.env.KEYSTATIC_GITHUB_CLIENT_ID
      ? {
          kind: "github",
          // CMS-006 / GATHER-001 item 7 — resolved: the real repo is
          // project-cherenkov/project-cherenkov-app. The env var still
          // takes precedence (so a fork or a differently-named deploy
          // isn't stuck pointing at this one), but the fallback is now a
          // real value rather than an invented one.
          repo: (process.env.KEYSTATIC_GITHUB_REPO ??
            "project-cherenkov/project-cherenkov-app") as `${string}/${string}`,
          branchPrefix: "keystatic/",
        }
      : { kind: "local" },
  collections: {
    astronomyEditorials: collection({
      label: "Editorials — Astronomy",
      slugField: "slug",
      path: "content/editorials/astronomy/*",
      format: { contentField: "content" },
      schema: editorialSchema("astronomy"),
    }),
    physicsEditorials: collection({
      label: "Editorials — Physics",
      slugField: "slug",
      path: "content/editorials/physics/*",
      format: { contentField: "content" },
      schema: editorialSchema("physics"),
    }),
    informaticsEditorials: collection({
      label: "Editorials — Informatics",
      slugField: "slug",
      path: "content/editorials/informatics/*",
      format: { contentField: "content" },
      schema: editorialSchema("informatics"),
    }),
  },
  singletons: {
    // BLOB-002 (team-photo path). The about page today renders team bios as
    // a single static i18n string with no per-person structure — this adds
    // that structure. Photos are NOT stored as a Keystatic image field
    // (which would write into git/local storage): the actual file upload
    // goes through app/api/team-photo/route.ts, which calls Vercel Blob's
    // put() directly and returns a public URL. Keystatic only stores that
    // resulting URL as text. This is a deliberate deviation from "just
    // point an existing field at Blob" — Keystatic's field system has no
    // built-in way to target arbitrary Blob storage without their separate
    // Cloud product, so the upload step is a small bespoke handler instead.
    team: singleton({
      label: "Team",
      path: "content/team/",
      format: { data: "json" },
      schema: {
        professionalContact: fields.object({
          email: fields.text({
            label: "Email",
            description: "Team-wide contact email for general and press inquiries.",
          }),
          label: fields.text({
            label: "Label",
            description: "Optional label, e.g. 'General & press inquiries'.",
          }),
        }),
        members: fields.array(
          fields.object({
            name: fields.text({ label: "Name", validation: { isRequired: true } }),
            role: fields.text({
              label: "Role",
              description: "e.g. Founder — Astronomy",
            }),
            bioEn: fields.text({ label: "Bio (English)", multiline: true }),
            bioId: fields.text({ label: "Bio (Indonesian)", multiline: true }),
            // Populated by pasting the URL returned from the team-photo
            // upload endpoint — see app/keystatic/team-photo/page.tsx.
            photoUrl: fields.url({
              label: "Photo URL",
              description:
                "Upload a photo via /keystatic/team-photo first, then paste the returned Blob URL here.",
            }),
            personalContact: fields.text({
              label: "Primary personal email",
              description: "Primary personal email or secondary contact handle.",
            }),
            personalContacts: fields.array(
              fields.object({
                label: fields.text({ label: "Label", validation: { isRequired: true } }),
                href: fields.text({ label: "URL or mailto link", validation: { isRequired: true } }),
                value: fields.text({ label: "Display text", validation: { isRequired: true } }),
              }),
              {
                label: "Personal contact links",
                description: "Extra links such as Instagram, LinkedIn, or secondary email.",
                itemLabel: (props) => props.fields.label.value || "Contact",
              },
            ),
          }),
          { label: "Team members", itemLabel: (props) => props.fields.name.value || "Member" },
        ),
      },
    }),
  },
});
