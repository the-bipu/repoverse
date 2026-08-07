import type { GithubTreeItem } from "./github";
import { fetchFileRaw } from "./github";

/**
 * NOT a real AST parser — this is a set of regexes over common import syntax
 * (JS/TS ES modules + CommonJS, Python). It's deliberately approximate:
 * catches the vast majority of real-world import statements without pulling
 * in a Tree-sitter WASM build per language. Dynamic imports built from
 * variables, re-exports through barrel files, and unusual syntax can be
 * missed. Good enough to draw "roads" between districts, not a substitute
 * for a real dependency analyzer.
 */
function extractSpecifiers(source: string, ext: string): string[] {
  const specifiers: string[] = [];

  if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext)) {
    const patterns = [
      /import\s+(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g,
      /export\s+(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g,
      /require\(\s*["']([^"']+)["']\s*\)/g,
      /import\(\s*["']([^"']+)["']\s*\)/g,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(source))) specifiers.push(m[1]);
    }
  } else if (ext === "py") {
    const patterns = [
      /^\s*from\s+([\w.]+)\s+import\s+/gm,
      /^\s*import\s+([\w.]+)/gm,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(source))) specifiers.push(m[1].replace(/\./g, "/"));
    }
  } else if (["go", "rs", "java", "php"].includes(ext)) {
    // Coarser fallback: quoted strings on import-ish lines only.
    const re = /^\s*(?:import|use)\s+.*?["']([^"']+)["']/gm;
    let m;
    while ((m = re.exec(source))) specifiers.push(m[1]);
  }

  return specifiers;
}

/**
 * Resolves an import specifier to one of the repo's top-level folder names,
 * or null if it doesn't clearly point at one (e.g. an npm package, or an
 * alias we can't confidently map).
 */
function resolveToTopLevel(
  specifier: string,
  sourcePath: string,
  topLevelNames: Set<string>
): string | null {
  let s = specifier;

  // Common alias used by this very project's own tsconfig — strip it so
  // "@/lib/github" resolves like a root-relative path.
  if (s.startsWith("@/")) s = s.slice(2);

  if (s.startsWith("./") || s.startsWith("../")) {
    const sourceDir = sourcePath.split("/").slice(0, -1);
    const parts = s.split("/");
    const stack = [...sourceDir];
    for (const part of parts) {
      if (part === "." || part === "") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    const top = stack[0];
    return top && topLevelNames.has(top) ? top : null;
  }

  const bareTop = s.split("/")[0];
  return topLevelNames.has(bareTop) ? bareTop : null;
}

const PARSEABLE_EXT = new Set(["js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "go", "rs", "java", "php"]);
const SKIP_NAME = /(\.min\.|\.lock$|-lock\.|\.map$)/;

export interface DependencyEdge {
  from: string;
  to: string;
  weight: number;
}

export interface DependencyResult {
  edges: DependencyEdge[];
  filesSampled: number;
}

/**
 * Samples up to `sampleCap` source files spread across top-level folders,
 * fetches their raw content (no API-quota cost — see fetchFileRaw), and
 * tallies import edges between top-level folders.
 */
export async function buildDependencyEdges(
  owner: string,
  repo: string,
  branch: string,
  treeItems: GithubTreeItem[],
  topLevelNames: string[],
  sampleCap = 40
): Promise<DependencyResult> {
  const names = new Set(topLevelNames);
  const perFolderCap = Math.max(1, Math.floor(sampleCap / Math.max(1, names.size)));

  const blobs = treeItems.filter((i) => i.type === "blob");
  const byFolder = new Map<string, GithubTreeItem[]>();
  for (const item of blobs) {
    const slash = item.path.indexOf("/");
    if (slash === -1) continue;
    const folder = item.path.slice(0, slash);
    if (!names.has(folder)) continue;
    const ext = item.path.split(".").pop()?.toLowerCase() ?? "";
    if (!PARSEABLE_EXT.has(ext)) continue;
    if (SKIP_NAME.test(item.path)) continue;
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder)!.push(item);
  }

  const sample: GithubTreeItem[] = [];
  for (const items of byFolder.values()) {
    // Prefer smaller files — cheaper to fetch, less likely to be bundled/vendored code.
    const sorted = [...items].sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
    sample.push(...sorted.slice(0, perFolderCap));
  }

  const edgeWeights = new Map<string, number>();
  let filesSampled = 0;

  await Promise.all(
    sample.map(async (item) => {
      const content = await fetchFileRaw(owner, repo, branch, item.path);
      if (content == null) return;
      filesSampled++;
      const ext = item.path.split(".").pop()?.toLowerCase() ?? "";
      const fromFolder = item.path.slice(0, item.path.indexOf("/"));
      const specifiers = extractSpecifiers(content, ext);
      for (const spec of specifiers) {
        const toFolder = resolveToTopLevel(spec, item.path, names);
        if (!toFolder || toFolder === fromFolder) continue;
        const key = `${fromFolder}->${toFolder}`;
        edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
      }
    })
  );

  const edges: DependencyEdge[] = Array.from(edgeWeights.entries())
    .map(([key, weight]) => {
      const [from, to] = key.split("->");
      return { from, to, weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 30);

  return { edges, filesSampled };
}
