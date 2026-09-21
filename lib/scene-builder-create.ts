import matter from "gray-matter";
import path from "node:path";
import { isKnownSubject, type Subject } from "@/lib/subjects";
import type { GithubClient, GithubFileContent } from "@/lib/scene-builder-github";
import {
  isGithubModeConfigured,
  isValidSlug,
  parseRepoEnv,
  realFsDeps,
  relativeContentPath,
  type FsDeps,
} from "@/lib/scene-builder-write";

// The counterpart to lib/scene-builder-write.ts's writeSceneConfig, but for
// the opposite starting condition: that function requires the target
// editorial to already exist; this one requires that it doesn't, and
// creates a minimal, schema-valid stub so the scene builder has somewhere
// to save into. Built for the "New visualization" entry point
// (app/keystatic/scene-builder/new) — see that page and
// components/site/scene-builder/new-visualization-form.tsx.

const MAX_TITLE_LENGTH = 120; // mirrors keystatic.config.ts's title field validation

function isValidTitle(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_TITLE_LENGTH;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Every *required* field in editorialSchema (velite.config.ts /
// keystatic.config.ts) gets a clearly-marked placeholder — this project's
// own convention for undecided content (see e.g.
// binary-search-on-answer.mdx's `author: "PLACEHOLDER Author Name"`) —
// except `title`, the one thing the New-visualization form actually asks
// for. `vizConfig` starts on "none", the same defaultValue
// keystatic.config.ts's own vizConfigConditional() field uses, deliberately
// *not* pre-set to whichever engine the author picked on that form: the
// scene builder overwrites this key entirely on first save regardless (see
// applyVizConfig in scene-builder-write.ts), and "none" is the one
// discriminant every branch of Keystatic's own main-form vizConfig field
// can still render (SCENE-009's composed-scene/programmable-scene branches
// are empty-object placeholders there) — so the stub stays editable in
// Keystatic's own form too, right up until a real scene is saved into it.
function buildStubFrontmatter(subject: Subject, title: string, publishedAt: string): string {
  const body = "<Interactive />\n\n<!-- PLACEHOLDER: write the full proof and prose here. -->\n";
  const data = {
    title,
    subject,
    hook: "PLACEHOLDER — one-sentence hook for this editorial.",
    tags: [] as string[],
    principle: "PLACEHOLDER — principle identifier, e.g. monotonic-predicate-search.",
    vizConfig: { discriminant: "none", value: {} },
    publishedAt,
    author: "PLACEHOLDER Author Name",
  };
  return matter.stringify(body, data);
}

export type CreateSceneStubResult =
  | { ok: true; mode: "local"; path: string }
  | { ok: true; mode: "github"; branch: string; commitUrl: string }
  | { ok: false; status: 400 | 401 | 409 | 500 | 502; error: string };

export interface CreateSceneStubParams {
  subject: string;
  slug: string;
  title: string;
}

export interface CreateSceneStubDeps {
  fsDeps?: FsDeps;
  githubClient?: GithubClient;
  /** Injected for deterministic branch-name assertions in tests. */
  now?: () => number;
  /** Overrides process.cwd() for local-mode path resolution — same purpose as WriteSceneConfigDeps.contentRoot. */
  contentRoot?: string;
  /** Injected for deterministic publishedAt assertions in tests. */
  today?: () => Date;
}

// Deliberately the same catch-all simplification writeLocal() in
// scene-builder-write.ts uses in the opposite direction: neither file
// distinguishes ENOENT from any other readFile failure, so "the read
// failed" is treated as "the file isn't there yet" here, just as it's
// treated as "the file isn't there" (404) in that one. A real permissions
// error would be rare and would still surface, just as a 409 rather than a
// 500 — an acceptable, already-established tradeoff, not a new one.
async function createLocal(
  absolutePath: string,
  content: string,
  fsDeps: FsDeps,
): Promise<CreateSceneStubResult> {
  const alreadyExists = await fsDeps
    .readFile(absolutePath)
    .then(() => true)
    .catch(() => false);
  if (alreadyExists) {
    return { ok: false, status: 409, error: "An editorial already exists at this subject/slug." };
  }

  try {
    await fsDeps.writeFile(absolutePath, content);
  } catch {
    return { ok: false, status: 500, error: "Failed to create the new file." };
  }

  return { ok: true, mode: "local", path: absolutePath };
}

async function createGithub(
  relativePath: string,
  content: string,
  slug: string,
  client: GithubClient,
  now: () => number,
): Promise<CreateSceneStubResult> {
  const repoInfo = parseRepoEnv();
  if (!repoInfo) {
    return { ok: false, status: 500, error: "KEYSTATIC_GITHUB_REPO is not configured correctly." };
  }
  const { owner, repo } = repoInfo;

  let existing: GithubFileContent | null;
  try {
    existing = await client.getFileContent(owner, repo, relativePath);
  } catch {
    return { ok: false, status: 502, error: "Failed to check for an existing file on GitHub." };
  }
  if (existing !== null) {
    return {
      ok: false,
      status: 409,
      error: "An editorial already exists at this subject/slug in the repository.",
    };
  }

  const branch = `keystatic/scene-builder-create-${slug}-${now()}`;
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
    // No `sha` — this is a new file, not an update. See the `sha?: string`
    // widening on GithubClient.putFileContent's params (scene-builder-github.ts).
    const result = await client.putFileContent(owner, repo, relativePath, {
      message: `scene-builder: create new editorial stub for ${slug}`,
      contentBase64: Buffer.from(content, "utf8").toString("base64"),
      branch,
    });
    return { ok: true, mode: "github", branch, commitUrl: result.commitUrl };
  } catch {
    return { ok: false, status: 502, error: "Failed to commit the new file to GitHub." };
  }
}

export async function createSceneStub(
  params: CreateSceneStubParams,
  deps: CreateSceneStubDeps = {},
): Promise<CreateSceneStubResult> {
  if (!isKnownSubject(params.subject)) {
    return { ok: false, status: 400, error: `Unknown subject: "${params.subject}".` };
  }
  if (!isValidSlug(params.slug)) {
    return { ok: false, status: 400, error: `Invalid slug: "${params.slug}".` };
  }
  if (!isValidTitle(params.title)) {
    return { ok: false, status: 400, error: "Title is required (max 120 characters)." };
  }

  const today = deps.today ?? (() => new Date());
  const content = buildStubFrontmatter(params.subject, params.title.trim(), isoDateOnly(today()));
  const relativePath = relativeContentPath(params.subject, params.slug);

  if (!isGithubModeConfigured()) {
    const fsDeps = deps.fsDeps ?? realFsDeps;
    const absolutePath = path.join(deps.contentRoot ?? process.cwd(), relativePath);
    return createLocal(absolutePath, content, fsDeps);
  }

  if (!deps.githubClient) {
    return {
      ok: false,
      status: 401,
      error: "GitHub authorization required to create a new editorial in this deployment.",
    };
  }
  const now = deps.now ?? (() => Date.now());
  return createGithub(relativePath, content, params.slug, deps.githubClient, now);
}
