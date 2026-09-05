import matter from "gray-matter";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isComposedSceneConfig, type ComposedSceneConfig } from "@/components/viz/composed-scene/types";
import { isKnownSubject, type Subject } from "@/lib/subjects";
import type { GithubClient } from "@/lib/scene-builder-github";

// Kebab-case only, matching every existing slug under content/editorials/
// (binary-search-on-answer, projectile-range-symmetry, ...). Rejecting
// anything else here is what keeps `subject`/`slug` safe to interpolate
// into a filesystem path below — no ".", "/", or "\" can ever reach
// path.join (R1: "validate subject/slug strictly ... before it ever
// touches a file path").
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

function relativeContentPath(subject: Subject, slug: string): string {
  return path.posix.join("content", "editorials", subject, `${slug}.mdx`);
}

export interface FsDeps {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
}

const realFsDeps: FsDeps = {
  readFile: (p) => readFile(p, "utf8"),
  writeFile: (p, content) => writeFile(p, content, "utf8"),
};

export type WriteSceneConfigResult =
  | { ok: true; mode: "local"; path: string }
  | { ok: true; mode: "github"; branch: string; commitUrl: string }
  | { ok: false; status: 400 | 401 | 404 | 500 | 502; error: string };

export interface WriteSceneConfigParams {
  subject: string;
  slug: string;
  vizConfig: unknown;
}

export interface WriteSceneConfigDeps {
  fsDeps?: FsDeps;
  githubClient?: GithubClient;
  /** Injected for deterministic branch-name assertions in tests. */
  now?: () => number;
  /** Overrides process.cwd() for local-mode path resolution — lets tests point at a tmp copy of real content instead of the actual repo tree. */
  contentRoot?: string;
}

// Rewrites exactly two frontmatter keys (vizEngine, vizConfig) and leaves
// everything else — including the MDX body — untouched. Verified
// empirically against the three real cited editorials (see
// scene-builder-write.test.ts's round-trip suite) before writing this:
// gray-matter's stringify reproduces the body byte-for-byte and every
// other frontmatter key deep-equal (NFR-3 / R2).
function applyVizConfig(raw: string, vizConfig: ComposedSceneConfig): string {
  const parsed = matter(raw);
  const nextData = { ...parsed.data, vizEngine: "composed-scene", vizConfig };
  return matter.stringify(parsed.content, nextData);
}

async function writeLocal(
  absolutePath: string,
  vizConfig: ComposedSceneConfig,
  fsDeps: FsDeps,
): Promise<WriteSceneConfigResult> {
  let raw: string;
  try {
    raw = await fsDeps.readFile(absolutePath);
  } catch {
    return { ok: false, status: 404, error: "Target editorial not found." };
  }

  let updated: string;
  try {
    updated = applyVizConfig(raw, vizConfig);
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Failed to parse or rewrite the target file's frontmatter.",
    };
  }

  try {
    await fsDeps.writeFile(absolutePath, updated);
  } catch {
    return { ok: false, status: 500, error: "Failed to write the target file." };
  }

  return { ok: true, mode: "local", path: absolutePath };
}

function parseRepoEnv(): { owner: string; repo: string } | null {
  const value = process.env.KEYSTATIC_GITHUB_REPO;
  if (!value) return null;
  const [owner, repo] = value.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

async function writeGithub(
  relativePath: string,
  vizConfig: ComposedSceneConfig,
  slug: string,
  client: GithubClient,
  now: () => number,
): Promise<WriteSceneConfigResult> {
  const repoInfo = parseRepoEnv();
  if (!repoInfo) {
    return { ok: false, status: 500, error: "KEYSTATIC_GITHUB_REPO is not configured correctly." };
  }
  const { owner, repo } = repoInfo;

  const file = await client.getFileContent(owner, repo, relativePath).catch(() => undefined);
  if (file === undefined) {
    return { ok: false, status: 502, error: "Failed to read the target file from GitHub." };
  }
  if (file === null) {
    return { ok: false, status: 404, error: "Target editorial not found in the repository." };
  }

  let updatedContent: string;
  try {
    const raw = Buffer.from(file.contentBase64, "base64").toString("utf8");
    updatedContent = applyVizConfig(raw, vizConfig);
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Failed to parse or rewrite the target file's frontmatter.",
    };
  }

  // Branch-per-save (R2/§7): "if the commit fails after the blob-SHA
  // fetch succeeds, nothing should be written" holds naturally here —
  // everything up to and including branch creation is either read-only or
  // just points a new ref at the *existing* base commit; the repository's
  // actual file content is only ever mutated by the final putFileContent
  // call below.
  const branch = `keystatic/scene-builder-${slug}-${now()}`;
  let baseSha: string;
  try {
    baseSha = await client.getDefaultBranchSha(owner, repo);
  } catch {
    return { ok: false, status: 502, error: "Failed to look up the repository's base branch." };
  }
  try {
    await client.createBranch(owner, repo, branch, baseSha);
  } catch {
    return { ok: false, status: 502, error: "Failed to create a branch for this change." };
  }

  try {
    const result = await client.putFileContent(owner, repo, relativePath, {
      message: `scene-builder: update composed-scene for ${slug}`,
      contentBase64: Buffer.from(updatedContent, "utf8").toString("base64"),
      sha: file.sha,
      branch,
    });
    return { ok: true, mode: "github", branch, commitUrl: result.commitUrl };
  } catch {
    return { ok: false, status: 502, error: "Failed to commit the change to GitHub." };
  }
}

// Same storage-mode signal keystatic.config.ts already uses to pick
// between LocalConfig and GitHubConfig (Decision B: "reuse the same
// already-configured KEYSTATIC_GITHUB_* env vars Keystatic itself reads"),
// so the write-back route and Keystatic's own admin UI never disagree
// about which mode the app is running in.
export function isGithubModeConfigured(): boolean {
  return Boolean(process.env.KEYSTATIC_GITHUB_CLIENT_ID);
}

export async function writeSceneConfig(
  params: WriteSceneConfigParams,
  deps: WriteSceneConfigDeps = {},
): Promise<WriteSceneConfigResult> {
  if (!isKnownSubject(params.subject)) {
    return { ok: false, status: 400, error: `Unknown subject: "${params.subject}".` };
  }
  if (!isValidSlug(params.slug)) {
    return { ok: false, status: 400, error: `Invalid slug: "${params.slug}".` };
  }
  if (!isComposedSceneConfig(params.vizConfig)) {
    return { ok: false, status: 400, error: "Invalid composed-scene configuration." };
  }

  const relativePath = relativeContentPath(params.subject, params.slug);

  if (!isGithubModeConfigured()) {
    const fsDeps = deps.fsDeps ?? realFsDeps;
    const absolutePath = path.join(deps.contentRoot ?? process.cwd(), relativePath);
    return writeLocal(absolutePath, params.vizConfig, fsDeps);
  }

  if (!deps.githubClient) {
    return {
      ok: false,
      status: 401,
      error: "GitHub authorization required to save in this deployment.",
    };
  }
  const now = deps.now ?? (() => Date.now());
  return writeGithub(relativePath, params.vizConfig, params.slug, deps.githubClient, now);
}
