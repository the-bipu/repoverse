export interface RepoMeta {
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  defaultBranch: string;
}

export interface GithubTreeItem {
  path: string;
  type: string; // "blob" | "tree" | "commit"
  sha: string;
  size?: number;
}

export interface GithubTreeResult {
  items: GithubTreeItem[];
  truncated: boolean;
}

/**
 * Accepts "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo",
 * with or without a trailing slash / ".git". Returns null if it can't parse.
 */
export function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.replace(/^github\.com\//, "");
  s = s.replace(/\.git$/, "");
  s = s.replace(/\/+$/, "");

  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  const validSegment = /^[A-Za-z0-9._-]+$/;
  if (!validSegment.test(owner) || !validSegment.test(repo)) return null;
  return { owner, repo };
}

async function githubFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
}

export async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
  const res = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (res.status === 404) {
    throw new Error("Repo not found — check the URL and make sure it's public.");
  }
  if (res.status === 403) {
    throw new Error("GitHub API rate limit hit. Wait a bit and try again.");
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}).`);
  }
  const data = await res.json();
  return {
    owner,
    repo,
    description: data.description ?? null,
    stars: data.stargazers_count ?? 0,
    defaultBranch: data.default_branch ?? "main",
  };
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<GithubTreeResult> {
  const res = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
      branch
    )}?recursive=1`
  );
  if (res.status === 403) {
    throw new Error("GitHub API rate limit hit. Wait a bit and try again.");
  }
  if (!res.ok) {
    throw new Error(`Couldn't load the file tree (${res.status}).`);
  }
  const data = await res.json();
  return {
    items: (data.tree ?? []) as GithubTreeItem[],
    truncated: Boolean(data.truncated),
  };
}
