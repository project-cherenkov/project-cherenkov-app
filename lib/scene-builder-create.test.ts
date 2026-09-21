import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile as fsReadFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import matter from "gray-matter";
import { createSceneStub } from "./scene-builder-create";
import type { GithubClient } from "./scene-builder-github";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createSceneStub — validation (short-circuits before touching fs)", () => {
  const explodingFsDeps = {
    readFile: vi.fn(async () => {
      throw new Error("readFile should not have been called");
    }),
    writeFile: vi.fn(async () => {
      throw new Error("writeFile should not have been called");
    }),
  };

  it("rejects an unknown subject", async () => {
    const result = await createSceneStub(
      { subject: "chemistry", slug: "x", title: "A title" },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("Unknown subject") });
  });

  it("rejects an invalid slug", async () => {
    const result = await createSceneStub(
      { subject: "physics", slug: "../escape", title: "A title" },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("Invalid slug") });
  });

  it("rejects an empty title", async () => {
    const result = await createSceneStub(
      { subject: "physics", slug: "new-viz", title: "   " },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("Title is required") });
  });

  it("rejects a title over 120 characters", async () => {
    const result = await createSceneStub(
      { subject: "physics", slug: "new-viz", title: "x".repeat(121) },
      { fsDeps: explodingFsDeps },
    );
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("Title is required") });
  });
});

describe("createSceneStub — local mode", () => {
  let root: string;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("creates a minimal, schema-shaped stub file that doesn't exist yet", async () => {
    root = mkdtempSync(join(tmpdir(), "scene-builder-create-test-"));
    // In the real repo, content/editorials/<subject>/ always already
    // exists (each subject has real, committed files) — createLocal()
    // relies on that and doesn't mkdir. Recreated here since this test's
    // tmp root starts genuinely empty.
    mkdirSync(join(root, "content", "editorials", "physics"), { recursive: true });
    const result = await createSceneStub(
      { subject: "physics", slug: "brand-new-viz", title: "Brand New Viz" },
      { contentRoot: root, today: () => new Date("2026-09-20T12:00:00Z") },
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== "local") throw new Error("expected a local-mode success result");
    expect(result.path).toBe(join(root, "content", "editorials", "physics", "brand-new-viz.mdx"));

    const raw = readFileSync(result.path, "utf8");
    const parsed = matter(raw);
    expect(parsed.data.title).toBe("Brand New Viz");
    expect(parsed.data.subject).toBe("physics");
    expect(parsed.data.publishedAt).toBe("2026-09-20");
    expect(parsed.data.author).toBe("PLACEHOLDER Author Name");
    // "none" — not either engine — see buildStubFrontmatter's own comment
    // on why: the scene builder overwrites this key on first save anyway.
    expect(parsed.data.vizConfig).toEqual({ discriminant: "none", value: {} });
    expect(parsed.content).toContain("<Interactive />");
  });

  it("trims the title before writing it", async () => {
    root = mkdtempSync(join(tmpdir(), "scene-builder-create-test-trim-"));
    mkdirSync(join(root, "content", "editorials", "informatics"), { recursive: true });
    const result = await createSceneStub(
      { subject: "informatics", slug: "trim-me", title: "  Trim Me  " },
      { contentRoot: root },
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== "local") throw new Error("expected a local-mode success result");
    const parsed = matter(readFileSync(result.path, "utf8"));
    expect(parsed.data.title).toBe("Trim Me");
  });

  it("returns 409 without writing when a file already exists at that subject/slug", async () => {
    // Reuses a real, already-committed slug — the create flow must refuse
    // to clobber an existing editorial exactly as readily as it succeeds
    // for a new one. Deliberately does NOT touch the shared `root` var
    // above (and its afterEach cleanup) — this points contentRoot at the
    // real repo tree read-only; nothing is created, so nothing needs
    // cleanup, and it must never be rmSync'd.
    const result = await createSceneStub(
      { subject: "physics", slug: "projectile-range-symmetry", title: "Should not overwrite" },
      { contentRoot: join(__dirname, "..") },
    );
    expect(result).toEqual({ ok: false, status: 409, error: expect.stringContaining("already exists") });
  });

  it("returns 500 without partially writing when the filesystem write fails", async () => {
    root = mkdtempSync(join(tmpdir(), "scene-builder-create-test-fail-"));
    const writeFile = vi.fn(async () => {
      throw new Error("disk full");
    });
    const result = await createSceneStub(
      { subject: "physics", slug: "will-fail", title: "Will Fail" },
      { contentRoot: root, fsDeps: { readFile: (p) => fsReadFile(p, "utf8"), writeFile } },
    );
    expect(result).toEqual({ ok: false, status: 500, error: expect.stringContaining("create") });
  });
});

describe("createSceneStub — GitHub mode", () => {
  function fakeClient(overrides: Partial<GithubClient> = {}): GithubClient {
    return {
      getDefaultBranchSha: vi.fn(async () => "base-sha-123"),
      getFileContent: vi.fn(async () => null), // doesn't exist yet, by default
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
    const result = await createSceneStub({
      subject: "physics",
      slug: "new-viz",
      title: "New Viz",
    });
    expect(result).toEqual({ ok: false, status: 401, error: expect.stringContaining("GitHub authorization") });
  });

  it("commits a new file with no `sha` to a new keystatic/-prefixed branch", async () => {
    stubGithubMode();
    const client = fakeClient();
    const result = await createSceneStub(
      { subject: "physics", slug: "new-viz", title: "New Viz" },
      { githubClient: client, now: () => 1735689600000, today: () => new Date("2026-09-20T12:00:00Z") },
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== "github") throw new Error("expected a github-mode success result");
    expect(result.branch).toBe("keystatic/scene-builder-create-new-viz-1735689600000");
    expect(result.commitUrl).toBe("https://github.com/o/r/commit/abc");

    const putCall = (client.putFileContent as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!putCall) throw new Error("putFileContent was not called");
    expect(putCall[2]).toBe("content/editorials/physics/new-viz.mdx");
    expect(putCall[3].sha).toBeUndefined();
    expect(putCall[3].branch).toBe(result.branch);

    const committedRaw = Buffer.from(putCall[3].contentBase64, "base64").toString("utf8");
    const parsed = matter(committedRaw);
    expect(parsed.data.title).toBe("New Viz");
    expect(parsed.data.vizConfig).toEqual({ discriminant: "none", value: {} });
  });

  it("returns 409 without creating a branch when the file already exists in the repository", async () => {
    stubGithubMode();
    const client = fakeClient({ getFileContent: vi.fn(async () => ({ sha: "abc", contentBase64: "" })) });
    const result = await createSceneStub(
      { subject: "physics", slug: "already-there", title: "Already There" },
      { githubClient: client },
    );
    expect(result).toEqual({ ok: false, status: 409, error: expect.stringContaining("already exists") });
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
    const result = await createSceneStub(
      { subject: "physics", slug: "new-viz", title: "New Viz" },
      { githubClient: client },
    );
    expect(result.ok).toBe(false);
    expect(client.createBranch).not.toHaveBeenCalled();
    expect(client.putFileContent).not.toHaveBeenCalled();
  });

  it("surfaces a commit failure as a 502 without throwing", async () => {
    stubGithubMode();
    const client = fakeClient({
      putFileContent: vi.fn(async () => {
        throw new Error("409 conflict");
      }),
    });
    const result = await createSceneStub(
      { subject: "physics", slug: "new-viz", title: "New Viz" },
      { githubClient: client },
    );
    expect(result).toEqual({ ok: false, status: 502, error: expect.stringContaining("commit") });
  });

  it("returns 500 when KEYSTATIC_GITHUB_REPO is missing or malformed", async () => {
    vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "client-id");
    vi.stubEnv("KEYSTATIC_GITHUB_REPO", "not-a-valid-repo-string");
    const client = fakeClient();
    const result = await createSceneStub(
      { subject: "physics", slug: "new-viz", title: "New Viz" },
      { githubClient: client },
    );
    expect(result).toEqual({ ok: false, status: 500, error: expect.stringContaining("KEYSTATIC_GITHUB_REPO") });
    expect(client.getFileContent).not.toHaveBeenCalled();
  });
});
