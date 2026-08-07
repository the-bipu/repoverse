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

/* ---------- v3: activity + contributors ---------- */

export interface PathActivity {
  lastCommitDate: string | null;
  commitCount: number;
  author: string | null;
}

/**
 * Reads the total-item count for a path out of the `Link: rel="last"` header
 * on a `per_page=1` request, instead of paginating through every commit.
 * If there's no "last" link, the result fit on one page (0 or 1 items).
 */
function parseLastPageFromLinkHeader(header: string | null): number | null {
  if (!header) return null;
  const match = header.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : null;
}

export async function fetchPathActivity(
  owner: string,
  repo: string,
  path: string
): Promise<PathActivity> {
  try {
    const res = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(
        path
      )}&per_page=1`
    );
    if (!res.ok) {
      return { lastCommitDate: null, commitCount: 0, author: null };
    }
    const data = await res.json();
    const lastPage = parseLastPageFromLinkHeader(res.headers.get("link"));
    const commitCount = lastPage ?? (Array.isArray(data) ? data.length : 0);
    const lastCommitDate =
      data?.[0]?.commit?.committer?.date ?? data?.[0]?.commit?.author?.date ?? null;
    // Prefer the GitHub-linked login; fall back to raw commit author name
    // (some commits have no linked account).
    const author = data?.[0]?.author?.login ?? data?.[0]?.commit?.author?.name ?? null;
    return { lastCommitDate, commitCount, author };
  } catch {
    // network hiccup on one path shouldn't fail the whole city
    return { lastCommitDate: null, commitCount: 0, author: null };
  }
}

export interface Contributor {
  login: string;
  avatarUrl: string;
  contributions: number;
  htmlUrl: string;
}

export async function fetchContributors(owner: string, repo: string): Promise<Contributor[]> {
  try {
    const res = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=8`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((c) => c?.login && c.type !== "Bot")
      .map((c) => ({
        login: c.login as string,
        avatarUrl: c.avatar_url as string,
        contributions: c.contributions as number,
        htmlUrl: c.html_url as string,
      }));
  } catch {
    return [];
  }
}

/* ---------- v4: source content, branches, PR preview, pulse ---------- */

/**
 * Raw file content via raw.githubusercontent.com — this host is NOT part of
 * the api.github.com rate limit, so sampling files for dependency parsing
 * doesn't compete with the 60/hr budget the rest of the app runs on.
 */
export async function fetchFileRaw(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(
        branch
      )}/${path.split("/").map(encodeURIComponent).join("/")}`
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export interface BranchInfo {
  name: string;
}

export async function fetchBranches(owner: string, repo: string): Promise<BranchInfo[]> {
  try {
    const res = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((b) => ({ name: b.name as string }));
  } catch {
    return [];
  }
}

export interface PRFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | string;
  additions: number;
  deletions: number;
}

export async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRFile[]> {
  const res = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`
  );
  if (res.status === 404) {
    throw new Error(`PR #${prNumber} not found on this repo.`);
  }
  if (!res.ok) {
    throw new Error(`Couldn't load PR #${prNumber} (${res.status}).`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((f) => ({
    filename: f.filename as string,
    status: f.status as string,
    additions: f.additions as number,
    deletions: f.deletions as number,
  }));
}

export interface WeeklyCommits {
  weekStart: number; // unix seconds
  total: number;
}

/**
 * GitHub computes this stat asynchronously on first request and can return
 * 202 while it warms the cache. Callers should treat `null` as "try again
 * shortly", not as a hard error.
 */
export async function fetchCommitActivity(
  owner: string,
  repo: string
): Promise<WeeklyCommits[] | null> {
  const res = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`
  );
  if (res.status === 202) return null;
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  return data.map((w) => ({ weekStart: w.week as number, total: w.total as number }));
}
