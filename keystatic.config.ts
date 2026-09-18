import { config, collection, singleton, fields } from "@keystatic/core";

// Mirrors velite.config.ts field-for-field (spec §11 CMS-002). If either
// schema changes, the other must change with it — there is no automated
// sync between them (flagged as a MEDIUM risk in the architect spec, §9).
// keystatic.config.test.ts is the automated check that catches drift going
// forward: it constructs a real reader against this config and asserts it
// can read every real content/editorials/**/*.mdx file (CH-01).
//
// CH-01 (architect audit round 1): this file's `vizConfig` field previously
// diverged from velite.config.ts's actual schema — velite.config.ts
// requires `vizConfig: { discriminant: <engine>, value: {...} }`, but this
// file bound `vizConfig` directly to a flat superset-of-fields object and
// kept the engine selector in a separate top-level `vizEngine` field. That
// mismatch made Keystatic's reader reject every real editorial ("Key on
// object value 'discriminant' is not allowed"), confirmed live against the
// repository's own content. The stale in-code claim that this was already
// verified via a "CMS-007 round-trip check" was wrong — it was not; the
// real check is keystatic.config.test.ts, added alongside this fix.
//
// Fix: `vizConfig` is now itself `fields.object({ discriminant, value })`,
// structurally matching velite.config.ts one-to-one — `discriminant` is a
// plain nested fields.select() matching every real content file.
// Everything else below (decisions #2–#5) still matches the original spec
// as written.
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
//   5. vizConfig.discriminant's select includes "none" as a legal value,
//      matching velite.config.ts today, even though it is flagged there as
//      conflicting with spec §1. Not this task's call to resolve.
//
// CH-03 (found via a live report that informaticsEditorials — and the
// other two subject collections — still showed every engine's fields,
// physics/astronomy included, regardless of subject or the chosen
// discriminant): CH-01's original fix shipped `vizConfig.value` as ONE
// flat fields.object() superset covering all three scalar engines' fields
// as optional siblings (graph-array-stepper's array/steps AND
// trajectory-sandbox's gravity/initial AND orbital-sandbox's eccentricity/
// massRatio, all always visible together). The comment that used to sit
// here claimed fields.conditional() couldn't be used instead, because it
// "flattens each branch's fields directly under value on disk" in a way
// that "can't accept" the fully generic, open-ended value shape that
// composed-scene/programmable-scene need. That claim was WRONG for the
// three scalar engines specifically — verified directly, not assumed:
// installed @keystatic/core@0.6.8 in isolation, built vizConfig as
// fields.conditional() with one typed branch per real engine, and
// round-tripped all three real hand-authored editorials
// (binary-search-on-answer.mdx, projectile-range-symmetry.mdx,
// eccentric-transit-duration.mdx) through a real reader — each came back
// with ONLY its own engine's fields, no cross-contamination, then
// confirmed the same against this repo's actual keystatic.config.test.ts
// (all 4 tests still pass; see that file's comments too).
//
// The claim IS still correct for composed-scene/programmable-scene: their
// value is an arbitrary tree (SceneElement[]/SceneControl[]/SceneStep[],
// or a recursive ProgramNode — components/viz/programmable-scene/types.ts)
// that no fixed Keystatic field set can represent, and no generic/JSON
// field type exists in this Keystatic version to fall back on (same
// finding as the `pointers` comment below). So `vizConfig` below is now a
// real fields.conditional() with a typed branch per scalar engine, and a
// placeholder branch for composed-scene/programmable-scene/none — opening
// an EXISTING composed-scene or programmable-scene editorial in this main
// form still fails today exactly as it did before this fix (confirmed:
// programmable-scene-fixture.mdx still throws the same
// "Key on object value ... is not allowed" class of error,
// keystatic.config.test.ts's own "documents ... the known
// programmable-scene limitation" test still passes unchanged) — those two
// engines are authored at the scene builder tool regardless, never
// through this field, so this is not a new regression, just an unchanged,
// already-documented limitation. What changes is real: the three engines
// that ARE authored through this form (every real editorial today) no
// longer show each other's fields.
function vizConfigConditional(subject: "astronomy" | "physics" | "informatics") {
  return fields.conditional(
    fields.select({
      label: "Visualization engine",
      options: [
        { label: "Graph / array stepper", value: "graph-array-stepper" },
        { label: "Trajectory sandbox", value: "trajectory-sandbox" },
        { label: "Orbital sandbox", value: "orbital-sandbox" },
        { label: "Composed scene", value: "composed-scene" },
        { label: "Programmable scene", value: "programmable-scene" },
        { label: "None", value: "none" },
      ],
      defaultValue: "none",
      // SCENE-009 / PROG-004, carried over from the old outer-object
      // description (see git history): composed-scene/programmable-scene
      // aren't authored here — see each branch's own placeholder below for
      // the concrete scene builder URL.
      description:
        `For "Composed scene" or "Programmable scene", build the scene at ` +
        `/keystatic/scene-builder?subject=${subject}&slug=<this editorial's slug> ` +
        `instead of setting fields here.`,
    }),
    {
      "graph-array-stepper": fields.object({
        array: fields.array(fields.number({ label: "Value" }), {
          label: "Array",
          itemLabel: (props) => String(props.value ?? ""),
        }),
        steps: fields.array(
          fields.object({
            // DEVIATION, found via the round-trip check: `pointers` is
            // documented in components/viz/graph-array-stepper/types.ts as
            // an open `Record<string, number>` (arbitrary named indices).
            // Neither fields.json() (doesn't exist in this Keystatic
            // version — checked against the package) nor fields.text()
            // holding raw JSON (tried; the real data is a genuine YAML
            // mapping, not a string, and Keystatic's reader rejects a
            // string where the file has a mapping) round-trips the real
            // data. What DOES work, verified against every real step in
            // content/editorials/informatics/binary-search-on-answer.mdx,
            // is a fixed-key object matching the only keys any current
            // editorial actually uses: lo, hi, mid (binary search's own
            // vocabulary). This is a genuine narrowing of the true
            // open-record type — an editorial using different pointer
            // names (e.g. a two-pointer technique's "left"/"right") will
            // NOT be authorable through this field as it stands. Flagging
            // as a real limitation, not silently covering for it:
            // extending this object with more optional named-pointer
            // fields as new algorithms are added is the pragmatic path
            // within this Keystatic version's real constraints.
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
      }),

      "trajectory-sandbox": fields.object({
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
      }),

      "orbital-sandbox": fields.object({
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
      }),

      // Placeholder branches: neither shape fits a fixed Keystatic field
      // set (see the CH-03 comment above) — both are authored visually
      // instead, at the same scene builder tool. Opening an EXISTING
      // editorial that already uses one of these two discriminants still
      // fails to load in this form today, same as before this fix; new
      // ones are created at the scene builder, not here.
      "composed-scene": fields.object(
        {},
        {
          description:
            `Build this at /keystatic/scene-builder?subject=${subject}&slug=<slug>. ` +
            `Saving there writes discriminant and value into this exact vizConfig field ` +
            `directly — nothing to set here.`,
        },
      ),
      "programmable-scene": fields.object(
        {},
        {
          description:
            `Build this at /keystatic/scene-builder?subject=${subject}&slug=<slug>. ` +
            `The builder validates and previews the program but does not yet write it ` +
            `back automatically — copy its compiled output into vizConfig.value by hand ` +
            `for now (see PROG-004 in git history).`,
        },
      ),
      none: fields.empty(),
    },
  );
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
    vizConfig: vizConfigConditional(subject),
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

// BUGFIX (production edit surface was unreachable — see chat thread): this
// file is imported by app/keystatic/keystatic.ts, which is a "use client"
// component, so keystatic.config.ts — including whatever branches the
// `storage` field on — is bundled into the BROWSER, not just the server.
//
// The previous check here was `process.env.KEYSTATIC_GITHUB_CLIENT_ID ? ... `.
// That env var is server-only (not NEXT_PUBLIC_-prefixed), so Next.js never
// inlines a value for it into client bundles — in the browser the reference
// is always `undefined`, so the ternary always took the `local` branch,
// no matter what was actually configured server-side. Net effect in
// production: the server's API route correctly ran in `github` mode, but
// the browser's Keystatic app always believed it was in `local` mode —
// never showed a "Sign in with GitHub" screen (local mode needs none),
// and sent local-mode-shaped requests that the github-mode server handler
// couldn't fulfill, surfacing as an instant 404 with a plain-text "Not
// Found" body (collections) or a stuck spinner (the Team singleton).
//
// Fix: branch on a NEXT_PUBLIC_ flag instead, so client and server agree.
// This flag is a plain boolean toggle, not a secret — safe to expose. The
// real KEYSTATIC_GITHUB_CLIENT_ID/SECRET stay server-only; they're read
// again below (still server-side only) to build the actual storage config.
const useGithubStorage = Boolean(process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_ENABLED);

export default config({
  storage: useGithubStorage
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
