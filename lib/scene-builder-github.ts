const GITHUB_API = "https://api.github.com";

export interface GithubFileContent {
  sha: string;
  contentBase64: string;
}

export interface GithubPutResult {
  commitUrl: string;
}

// One method per GitHub API call the write-back flow needs (§7): read the
// current file + its blob SHA, find the default branch's tip commit,
// create a new branch from it, then commit the updated content to that
// branch. Kept as an interface (rather than calling `fetch` directly from
// scene-builder-write.ts) so tests can supply a fake implementation
// instead of mocking global fetch — same "extract an interface, inject it"
// shape as lib/planner-actions.ts's deps object.
export interface GithubClient {
  getDefaultBranchSha(owner: string, repo: string): Promise<string>;
  getFileContent(owner: string, repo: string, path: string): Promise<GithubFileContent | null>;
  createBranch(owner: string, repo: string, branch: string, fromSha: string): Promise<void>;
  putFileContent(
    owner: string,
    repo: string,
    path: string,
    params: { message: string; contentBase64: string; sha: string; branch: string },
  ): Promise<GithubPutResult>;
}

export function createGithubClient(token: string, fetchImpl: typeof fetch = fetch): GithubClient {
  async function githubFetch(urlPath: string, init?: RequestInit): Promise<Response> {
    return fetchImpl(`${GITHUB_API}${urlPath}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers ?? {}),
      },
    });
  }

  return {
    async getDefaultBranchSha(owner, repo) {
      const repoRes = await githubFetch(`/repos/${owner}/${repo}`);
      if (!repoRes.ok) throw new Error(`Failed to load repository metadata (${repoRes.status}).`);
      const repoJson = (await repoRes.json()) as { default_branch: string };

      const refRes = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${repoJson.default_branch}`);
      if (!refRes.ok) throw new Error(`Failed to load base branch ref (${refRes.status}).`);
      const refJson = (await refRes.json()) as { object: { sha: string } };
      return refJson.object.sha;
    },

    async getFileContent(owner, repo, filePath) {
      const res = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Failed to read file from GitHub (${res.status}).`);
      const json = (await res.json()) as { sha: string; content: string };
      return { sha: json.sha, contentBase64: json.content };
    },

    async createBranch(owner, repo, branch, fromSha) {
      const res = await githubFetch(`/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }),
      });
      if (!res.ok) throw new Error(`Failed to create branch (${res.status}).`);
    },

    async putFileContent(owner, repo, filePath, params) {
      const res = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: params.message,
          content: params.contentBase64,
          sha: params.sha,
          branch: params.branch,
        }),
      });
      if (!res.ok) throw new Error(`Failed to commit to GitHub (${res.status}).`);
      const json = (await res.json()) as { commit: { html_url: string } };
      return { commitUrl: json.commit.html_url };
    },
  };
}
