import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile as fsReadFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import matter from "gray-matter";
import { isValidSlug, writeSceneConfig } from "./scene-builder-write";
import type { GithubClient } from "./scene-builder-github";
import type { ComposedSceneConfig } from "@/components/viz/composed-scene/types";
import type { ProgrammableSceneConfig } from "@/components/viz/programmable-scene/types";

function validConfig(): ComposedSceneConfig {
  return {
    canvas: { widthPx: 320, heightPx: 200 },
    elements: [{ id: "el1", templateId: "shape-circle", params: { x: 10, y: 10, radius: 20, color: "blue" } }],
  };
}

// Mirrors content/editorials/informatics/programmable-scene-fixture.mdx's
// own program — the smallest program the engine accepts (PROG-004's own
// fixture), reused here rather than invented fresh so this test and that
// real fixture can't quietly drift apart on what "valid" means.
function validProgrammableConfig(): ProgrammableSceneConfig {
  return {
    canvas: { widthPx: 320, heightPx: 200 },
    program: {
      kind: "sequence",
      body: [
        {
          kind: "emitElement",
          templateId: "shape-circle",
          params: {
            x: { kind: "literal", value: 160 },
            y: { kind: "literal", value: 100 },
            radius: { kind: "literal", value: 30 },
            color: { kind: "literal", value: "blue" },
          },
        },
      ],
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isValidSlug", () => {
  it("accepts real kebab-case slugs used in this repo", () => {
    expect(isValidSlug("binary-search-on-answer")).toBe(true);
    expect(isValidSlug("projectile-range-symmetry")).toBe(true);
  });

  it("rejects path-traversal and other unsafe input", () => {
    expect(isValidSlug("../../etc/passwd")).toBe(false);
    expect(isValidSlug("foo/bar")).toBe(false);
    expect(isValidSlug("foo\\bar")).toBe(false);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Has Spaces")).toBe(false);
    expect(isValidSlug("UPPERCASE")).toBe(false);
  });
});

describe("writeSceneConfig — validation (short-circuits before touching fs)", () => {
  const explodingFsDeps = {
    readFile: vi.fn(async () => {
      throw new Error("readFile should not have been called");
    }),
    writeFile: vi.fn(async () => {
      throw new Error("writeFile should not have been called");
    }),
  };

  it("rejects an unknown subject", async () => {
    const result = await writeSceneConfig(
      { subject: "chemistry", slug: "x", vizConfig: validConfig() },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("Unknown subject") });
  });

  it("rejects an invalid slug", async () => {
    const result = await writeSceneConfig(
      { subject: "physics", slug: "../escape", vizConfig: validConfig() },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("Invalid slug") });
  });

  it("rejects an invalid vizConfig", async () => {
    const result = await writeSceneConfig(
      { subject: "physics", slug: "projectile-range-symmetry", vizConfig: { not: "valid" } },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: expect.stringContaining("Invalid composed-scene configuration"),
    });
  });

  it("rejects an unknown engine", async () => {
    const result = await writeSceneConfig(
      {
        subject: "physics",
        slug: "projectile-range-symmetry",
        vizConfig: validConfig(),
        engine: "trajectory-sandbox" as never,
      },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("Unknown engine") });
  });

  it("rejects an invalid programmable-scene vizConfig when engine is programmable-scene", async () => {
    const result = await writeSceneConfig(
      {
        subject: "physics",
        slug: "projectile-range-symmetry",
        // A composed-scene config is not a valid programmable-scene one —
        // proves the two engines are actually validated against different
        // guards, not just stamped with whichever discriminant was asked for.
        vizConfig: validConfig(),
        engine: "programmable-scene",
      },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: expect.stringContaining("Invalid programmable-scene configuration"),
    });
  });
});

describe("writeSceneConfig — local mode round-trip against real content", () => {
  const repoRoot = join(__dirname, "..");
  const realFiles = [
    { subject: "informatics", slug: "binary-search-on-answer" },
    { subject: "physics", slug: "projectile-range-symmetry" },
    { subject: "astronomy", slug: "eccentric-transit-duration" },
  ] as const;

  let tmpRoot: string;

  afterAll(() => {
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  });

  // Copies the three real cited editorials into a scratch directory (never
  // the repo's own content/ tree) so this test exercises real, non-
  // synthetic frontmatter without ever mutating tracked files.
  function setUpTmpCopy(subject: string, slug: string): { tmpRoot: string; originalRaw: string } {
    tmpRoot = mkdtempSync(join(tmpdir(), "scene-builder-test-"));
    const dir = join(tmpRoot, "content", "editorials", subject);
    mkdirSync(dir, { recursive: true });
    const originalRaw = readFileSync(join(repoRoot, "content", "editorials", subject, `${slug}.mdx`), "utf8");
    writeFileSync(join(dir, `${slug}.mdx`), originalRaw, "utf8");
    return { tmpRoot, originalRaw };
  }

  for (const { subject, slug } of realFiles) {
    it(`rewrites only vizConfig in ${subject}/${slug}.mdx, byte-identical body, all other frontmatter deep-equal`, async () => {
      const { tmpRoot: root, originalRaw } = setUpTmpCopy(subject, slug);
      const newVizConfig = validConfig();

      const result = await writeSceneConfig(
        { subject, slug, vizConfig: newVizConfig },
        { contentRoot: root },
      );

      expect(result.ok).toBe(true);
      if (!result.ok || result.mode !== "local") throw new Error("expected a local-mode success result");

      const updatedRaw = readFileSync(result.path, "utf8");
      const before = matter(originalRaw);
      const after = matter(updatedRaw);

      // R2/NFR-3: body byte-identical.
      expect(after.content).toBe(before.content);

      // Every other frontmatter key deep-equal; only vizConfig changed.
      const beforeKeys = Object.keys(before.data).filter((k) => k !== "vizConfig");
      for (const key of beforeKeys) {
        expect(after.data[key]).toEqual(before.data[key]);
      }
      expect(after.data.vizConfig).toEqual({ discriminant: "composed-scene", value: newVizConfig });
    });
  }

  // CH-02 (architect audit round 1): the only prior coverage for this write
  // path used real fixtures that all started on `vizConfig.discriminant:
  // "composed-scene"` already, or used a synthetic GitHub-mode fixture with
  // no discriminant at all — neither actually proves the write path
  // *changes* the discriminant when converting an editorial that starts on
  // a different engine. This synthetic fixture starts on
  // "trajectory-sandbox" and asserts the save actually switches it.
  it("switches vizConfig.discriminant when converting from a different engine", async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), "scene-builder-test-switch-"));
    const dir = join(tmpRoot, "content", "editorials", "physics");
    mkdirSync(dir, { recursive: true });
    const originalRaw = matter.stringify("Body content here.\n", {
      title: "Switch me",
      vizConfig: { discriminant: "trajectory-sandbox", value: { physicsType: "projectile" } },
    });
    writeFileSync(join(dir, "switch-me.mdx"), originalRaw, "utf8");

    const newVizConfig = validConfig();
    const result = await writeSceneConfig(
      { subject: "physics", slug: "switch-me", vizConfig: newVizConfig },
      { contentRoot: tmpRoot },
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== "local") throw new Error("expected a local-mode success result");
    const after = matter(readFileSync(result.path, "utf8"));
    expect(after.data.vizConfig).toEqual({ discriminant: "composed-scene", value: newVizConfig });
    expect(after.data.title).toBe("Switch me");
  });

  // Same round-trip guarantee as the composed-scene loop above, exercised
  // against the one real programmable-scene editorial this repo has
  // (content/editorials/informatics/programmable-scene-fixture.mdx) — the
  // engine's write path had no test at all before this, since it had no
  // write path at all before this.
  it("rewrites vizConfig with the programmable-scene discriminant against the real fixture", async () => {
    const { tmpRoot: root, originalRaw } = setUpTmpCopy("informatics", "programmable-scene-fixture");
    const newVizConfig = validProgrammableConfig();

    const result = await writeSceneConfig(
      { subject: "informatics", slug: "programmable-scene-fixture", vizConfig: newVizConfig, engine: "programmable-scene" },
      { contentRoot: root },
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== "local") throw new Error("expected a local-mode success result");

    const updatedRaw = readFileSync(result.path, "utf8");
    const before = matter(originalRaw);
    const after = matter(updatedRaw);

    expect(after.content).toBe(before.content);
    const beforeKeys = Object.keys(before.data).filter((k) => k !== "vizConfig");
    for (const key of beforeKeys) {
      expect(after.data[key]).toEqual(before.data[key]);
    }
    expect(after.data.vizConfig).toEqual({ discriminant: "programmable-scene", value: newVizConfig });
  });

  it("returns 404 when the target file doesn't exist", async () => {
    const root = mkdtempSync(join(tmpdir(), "scene-builder-test-empty-"));
    try {
      const result = await writeSceneConfig(
        { subject: "physics", slug: "does-not-exist", vizConfig: validConfig() },
        { contentRoot: root },
      );
      expect(result).toEqual({ ok: false, status: 404, error: expect.stringContaining("not found") });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns 500 without partially writing when the filesystem write fails", async () => {
    const { tmpRoot: root } = setUpTmpCopy("physics", "projectile-range-symmetry");
    const writeFile = vi.fn(async () => {
      throw new Error("disk full");
    });
    const result = await writeSceneConfig(
      { subject: "physics", slug: "projectile-range-symmetry", vizConfig: validConfig() },
      { contentRoot: root, fsDeps: { readFile: (p) => fsReadFile(p, "utf8"), writeFile } },
    );
    expect(result).toEqual({ ok: false, status: 500, error: expect.stringContaining("write") });
  });
});

describe("writeSceneConfig — GitHub mode", () => {
  function fakeClient(overrides: Partial<GithubClient> = {}): GithubClient {
    return {
      getDefaultBranchSha: vi.fn(async () => "base-sha-123"),
      getFileContent: vi.fn(async () => ({
        sha: "file-sha-abc",
        contentBase64: Buffer.from(
          "---\ntitle: Test\nsubject: physics\n---\nBody content here.\n",
          "utf8",
        ).toString("base64"),
      })),
      createBranch: vi.fn(async () => undefined),
      putFileContent: vi.fn(async () => ({ commitUrl: "https://github.com/o/r/commit/abc" })),
      ...overrides,
    };
  }

  function stubGithubMode() {
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "client-id");
    vi.stubEnv("KEYSTATIC_GITHUB_REPO", "the-owner/the-repo");
  }

  it("returns 401 when github mode is configured but no client/token was supplied", async () => {
    stubGithubMode();
    const result = await writeSceneConfig({
      subject: "physics",
      slug: "projectile-range-symmetry",
      vizConfig: validConfig(),
    });
    expect(result).toEqual({ ok: false, status: 401, error: expect.stringContaining("GitHub authorization") });
  });

  it("commits to a new keystatic/-prefixed branch and returns its commit URL", async () => {
    stubGithubMode();
    const client = fakeClient();
    const result = await writeSceneConfig(
      { subject: "physics", slug: "projectile-range-symmetry", vizConfig: validConfig() },
      { githubClient: client, now: () => 1735689600000 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== "github") throw new Error("expected a github-mode success result");
    expect(result.branch).toBe("keystatic/scene-builder-projectile-range-symmetry-1735689600000");
    expect(result.commitUrl).toBe("https://github.com/o/r/commit/abc");

    expect(client.createBranch).toHaveBeenCalledWith(
      "the-owner",
      "the-repo",
      result.branch,
      "base-sha-123",
    );
    const putCall = (client.putFileContent as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!putCall) throw new Error("putFileContent was not called");
    expect(putCall[0]).toBe("the-owner");
    expect(putCall[1]).toBe("the-repo");
    expect(putCall[2]).toBe("content/editorials/physics/projectile-range-symmetry.mdx");
    expect(putCall[3].sha).toBe("file-sha-abc");
    expect(putCall[3].branch).toBe(result.branch);

    // The committed content actually contains the new vizConfig and
    // preserves the original body/frontmatter, same as local mode.
    const committedRaw = Buffer.from(putCall[3].contentBase64, "base64").toString("utf8");
    const parsed = matter(committedRaw);
    // CH-01/CH-02 (architect audit round 1): vizConfig.discriminant is the
    // sole engine selector — there is no separate `vizEngine` frontmatter
    // key (see keystatic.config.ts and applyVizConfig in
    // lib/scene-builder-write.ts, which has only ever written this exact
    // {discriminant, value} shape).
    expect(parsed.data.vizConfig).toEqual({ discriminant: "composed-scene", value: validConfig() });
    expect(parsed.data.title).toBe("Test");
    expect(parsed.content).toBe("Body content here.\n");
  });

  it("commits a programmable-scene save with the engine-specific commit message and discriminant", async () => {
    stubGithubMode();
    const client = fakeClient();
    const result = await writeSceneConfig(
      {
        subject: "informatics",
        slug: "programmable-scene-fixture",
        vizConfig: validProgrammableConfig(),
        engine: "programmable-scene",
      },
      { githubClient: client, now: () => 1735689600000 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== "github") throw new Error("expected a github-mode success result");

    const putCall = (client.putFileContent as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!putCall) throw new Error("putFileContent was not called");
    expect(putCall[3].message).toBe("scene-builder: update programmable-scene for programmable-scene-fixture");

    const committedRaw = Buffer.from(putCall[3].contentBase64, "base64").toString("utf8");
    const parsed = matter(committedRaw);
    expect(parsed.data.vizConfig).toEqual({
      discriminant: "programmable-scene",
      value: validProgrammableConfig(),
    });
  });

  it("returns 404 when the file doesn't exist in the repository", async () => {
    stubGithubMode();
    const client = fakeClient({ getFileContent: vi.fn(async () => null) });
    const result = await writeSceneConfig(
      { subject: "physics", slug: "projectile-range-symmetry", vizConfig: validConfig() },
      { githubClient: client },
    );
    expect(result).toEqual({ ok: false, status: 404, error: expect.stringContaining("not found") });
    expect(client.createBranch).not.toHaveBeenCalled();
    expect(client.putFileContent).not.toHaveBeenCalled();
  });

  it("stops before creating a branch if reading the base branch fails, writing nothing", async () => {
    stubGithubMode();
    const client = fakeClient({
      getDefaultBranchSha: vi.fn(async () => {
        throw new Error("network error");
      }),
    });
    const result = await writeSceneConfig(
      { subject: "physics", slug: "projectile-range-symmetry", vizConfig: validConfig() },
      { githubClient: client },
    );
    expect(result.ok).toBe(false);
    expect(client.createBranch).not.toHaveBeenCalled();
    expect(client.putFileContent).not.toHaveBeenCalled();
  });

  it("stops before committing if branch creation fails, writing nothing (R2 partial-failure guarantee)", async () => {
    stubGithubMode();
    const client = fakeClient({
      createBranch: vi.fn(async () => {
        throw new Error("branch already exists");
      }),
    });
    const result = await writeSceneConfig(
      { subject: "physics", slug: "projectile-range-symmetry", vizConfig: validConfig() },
      { githubClient: client },
    );
    expect(result.ok).toBe(false);
    expect(client.putFileContent).not.toHaveBeenCalled();
  });

  it("surfaces a commit failure as a 502 without throwing", async () => {
    stubGithubMode();
    const client = fakeClient({
      putFileContent: vi.fn(async () => {
        throw new Error("409 conflict");
      }),
    });
    const result = await writeSceneConfig(
      { subject: "physics", slug: "projectile-range-symmetry", vizConfig: validConfig() },
      { githubClient: client },
    );
    expect(result).toEqual({ ok: false, status: 502, error: expect.stringContaining("commit") });
  });

  it("returns 500 when KEYSTATIC_GITHUB_REPO is missing or malformed", async () => {
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "client-id");
    vi.stubEnv("KEYSTATIC_GITHUB_REPO", "not-a-valid-repo-string");
    const client = fakeClient();
    const result = await writeSceneConfig(
      { subject: "physics", slug: "projectile-range-symmetry", vizConfig: validConfig() },
      { githubClient: client },
    );
    expect(result).toEqual({ ok: false, status: 500, error: expect.stringContaining("KEYSTATIC_GITHUB_REPO") });
    expect(client.getFileContent).not.toHaveBeenCalled();
  });
});
