import type { GithubTreeItem } from "./github";

export interface CityBuilding {
  id: string;
  name: string;
  kind: "folder" | "file";
  fileCount: number;
  height: number;
  col: number;
  row: number;
}

export interface CityData {
  buildings: CityBuilding[];
  columns: number;
  stats: {
    totalFiles: number;
    totalFolders: number;
    topLevelItems: number;
    truncated: boolean;
  };
}

/**
 * v2 scope: only top-level entries become buildings. A folder's height is the
 * (log-scaled) count of files anywhere inside it. Root-level files are their
 * own small buildings. Nested per-file buildings arrive in a later version.
 */
export function buildCityFromTree(items: GithubTreeItem[], truncated: boolean): CityData {
  const topFolderCounts = new Map<string, number>();
  let totalFiles = 0;
  let totalFolders = 0;

  for (const item of items) {
    if (item.type === "tree") {
      totalFolders++;
      continue;
    }
    if (item.type !== "blob") continue;
    totalFiles++;

    const slashIndex = item.path.indexOf("/");
    if (slashIndex !== -1) {
      const folder = item.path.slice(0, slashIndex);
      topFolderCounts.set(folder, (topFolderCounts.get(folder) ?? 0) + 1);
    }
  }

  const entries: { name: string; kind: "folder" | "file"; fileCount: number }[] = [];

  for (const [name, fileCount] of topFolderCounts.entries()) {
    entries.push({ name, kind: "folder", fileCount });
  }
  for (const item of items) {
    if (item.type === "blob" && item.path.indexOf("/") === -1) {
      entries.push({ name: item.path, kind: "file", fileCount: 1 });
    }
  }

  entries.sort((a, b) => b.fileCount - a.fileCount);

  const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));

  const buildings: CityBuilding[] = entries.map((e, i) => ({
    id: `${e.kind}-${e.name}`,
    name: e.name,
    kind: e.kind,
    fileCount: e.fileCount,
    height: Math.max(0.6, Math.log2(e.fileCount + 1) * 1.6),
    col: i % columns,
    row: Math.floor(i / columns),
  }));

  return {
    buildings,
    columns,
    stats: {
      totalFiles,
      totalFolders,
      topLevelItems: entries.length,
      truncated,
    },
  };
}

/* ---------- v3: activity / heatmap ---------- */

export type ActivityLevel = "fresh" | "active" | "veryActive" | "dead" | "unknown";

export interface BuildingActivity {
  level: ActivityLevel;
  lastCommitDate: string | null;
  commitCount: number;
  author?: string | null;
}

/**
 * Heuristic classification from one cheap signal per building: days since the
 * last commit on that path, plus an approximate total commit count. This is
 * an approximation, not a real churn analysis — good enough for a first pass
 * at "what's alive vs dead", refined later with fuller commit history.
 */
export function classifyActivity(a: { lastCommitDate: string | null; commitCount: number }): ActivityLevel {
  if (!a.lastCommitDate || a.commitCount === 0) return "dead";
  const days = (Date.now() - new Date(a.lastCommitDate).getTime()) / 86_400_000;
  if (days <= 30 && a.commitCount >= 20) return "veryActive";
  if (days <= 30) return "fresh";
  if (days <= 180) return "active";
  return "dead";
}

// Matches the product spec: green = recent, yellow = moderate, red = very active, gray = dead.
export const ACTIVITY_COLORS: Record<ActivityLevel, string> = {
  fresh: "#4ADE80",
  active: "#FACC15",
  veryActive: "#FF6B6B",
  dead: "#4B5563",
  unknown: "#334155",
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  fresh: "Recently updated",
  active: "Moderately active",
  veryActive: "Very active",
  dead: "Dead / stale",
  unknown: "Loading…",
};

// Only fetch per-building activity for the N largest buildings, so a repo
// with 60 top-level folders can't blow the 60-req/hr unauthenticated budget.
export const MAX_ACTIVITY_BUILDINGS = 20;

/* ---------- v4: shared layout, branch diff, PR diff ---------- */

// Shared with City3D so dependency-road endpoints line up with building
// positions exactly — one source of truth for the grid math.
export const CITY_GAP = 2.2;

export function getBuildingPosition(
  b: Pick<CityBuilding, "col" | "row">,
  columns: number
): [number, number] {
  const x = (b.col - (columns - 1) / 2) * CITY_GAP;
  const z = b.row * CITY_GAP;
  return [x, z];
}

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface BuildingDiff {
  status: DiffStatus;
  added: number;
  removed: number;
  modified: number;
}

// Matches the product spec: green = added, red = deleted, blue = modified.
export const DIFF_COLORS: Record<DiffStatus, string> = {
  added: "#4ADE80",
  removed: "#FF6B6B",
  modified: "#60A5FA",
  unchanged: "#2A3244",
};

function topLevelCounts(items: GithubTreeItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.type !== "blob") continue;
    const slash = item.path.indexOf("/");
    const top = slash === -1 ? item.path : item.path.slice(0, slash);
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return counts;
}

/**
 * Compares two branches by top-level file counts (not a real content diff —
 * cheap to compute from trees we already have to fetch). A folder present in
 * both but with a different count is called "modified"; present only in the
 * compare branch is "added"; present only in the base branch is "removed".
 */
export function buildBranchDiff(
  baseItems: GithubTreeItem[],
  compareItems: GithubTreeItem[]
): Record<string, BuildingDiff> {
  const base = topLevelCounts(baseItems);
  const compare = topLevelCounts(compareItems);
  const names = new Set([...base.keys(), ...compare.keys()]);
  const result: Record<string, BuildingDiff> = {};

  for (const name of names) {
    const b = base.get(name);
    const c = compare.get(name);
    if (b == null && c != null) {
      result[name] = { status: "added", added: c, removed: 0, modified: 0 };
    } else if (b != null && c == null) {
      result[name] = { status: "removed", added: 0, removed: b, modified: 0 };
    } else if (b !== c) {
      result[name] = { status: "modified", added: 0, removed: 0, modified: Math.abs((c ?? 0) - (b ?? 0)) };
    } else {
      result[name] = { status: "unchanged", added: 0, removed: 0, modified: 0 };
    }
  }
  return result;
}

/**
 * Aggregates a PR's changed-files list up to the top-level folder each file
 * lives in, so we can highlight only the buildings a PR actually touches.
 */
export function buildPRDiff(
  files: { filename: string; status: string }[]
): Record<string, BuildingDiff> {
  const result: Record<string, BuildingDiff> = {};

  for (const f of files) {
    const slash = f.filename.indexOf("/");
    const top = slash === -1 ? f.filename : f.filename.slice(0, slash);
    if (!result[top]) result[top] = { status: "unchanged", added: 0, removed: 0, modified: 0 };
    if (f.status === "added") result[top].added++;
    else if (f.status === "removed") result[top].removed++;
    else result[top].modified++;
  }

  for (const key of Object.keys(result)) {
    const d = result[key];
    if (d.added > 0 && d.removed === 0 && d.modified === 0) d.status = "added";
    else if (d.removed > 0 && d.added === 0 && d.modified === 0) d.status = "removed";
    else d.status = "modified";
  }

  return result;
}
