"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchRepoMeta,
  fetchRepoTree,
  fetchContributors,
  fetchPathActivity,
  fetchBranches,
  fetchPRFiles,
  fetchCommitActivity,
  parseRepoInput,
  type RepoMeta,
  type Contributor,
  type BranchInfo,
  type GithubTreeItem,
  type WeeklyCommits,
} from "@/lib/github";
import {
  buildCityFromTree,
  classifyActivity,
  buildBranchDiff,
  buildPRDiff,
  MAX_ACTIVITY_BUILDINGS,
  type CityData,
  type BuildingActivity,
  type BuildingDiff,
} from "@/lib/buildCity";
import { buildDependencyEdges, type DependencyEdge } from "@/lib/dependencies";
import City3D, { type CityMode } from "@/components/City3D";
import ContributorRow from "@/components/ContributorRow";
import PulseChart from "@/components/PulseChart";
import AiTourPanel from "@/components/AiTourPanel";

type Status = "loading" | "error" | "ready";
type ColorMode = "structure" | "heatmap" | "compare" | "pr";

export default function CityPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const repoParam = params.get("repo") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [city, setCity] = useState<CityData | null>(null);
  const [baseTreeItems, setBaseTreeItems] = useState<GithubTreeItem[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [activity, setActivity] = useState<Record<string, BuildingActivity>>({});
  const [activityLoading, setActivityLoading] = useState(false);
  const [mode, setMode] = useState<ColorMode>("structure");

  // v4: dependency roads
  const [edges, setEdges] = useState<DependencyEdge[]>([]);
  const [edgesLoading, setEdgesLoading] = useState(false);
  const [showRoads, setShowRoads] = useState(false);

  // v4: branch comparison
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [compareBranch, setCompareBranch] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareDiff, setCompareDiff] = useState<Record<string, BuildingDiff>>({});

  // v4: PR preview
  const [prInput, setPrInput] = useState("");
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState("");
  const [prDiff, setPrDiff] = useState<Record<string, BuildingDiff>>({});
  const [activePr, setActivePr] = useState<number | null>(null);

  // v4: pulse + AI tour
  const [pulse, setPulse] = useState<WeeklyCommits[] | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    const parsed = parseRepoInput(repoParam);
    if (!parsed) {
      setStatus("error");
      setError("That doesn't look like a valid GitHub repo. Try owner/repo.");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError("");
    setCity(null);
    setContributors([]);
    setActivity({});
    setEdges([]);
    setShowRoads(false);
    setBranches([]);
    setCompareBranch("");
    setCompareDiff({});
    setPrInput("");
    setPrDiff({});
    setActivePr(null);
    setPulse(null);
    setMode("structure");

    (async () => {
      try {
        const repoMeta = await fetchRepoMeta(parsed.owner, parsed.repo);
        const tree = await fetchRepoTree(parsed.owner, parsed.repo, repoMeta.defaultBranch);
        if (cancelled) return;

        const cityData = buildCityFromTree(tree.items, tree.truncated);
        setMeta(repoMeta);
        setCity(cityData);
        setBaseTreeItems(tree.items);
        setStatus("ready");

        fetchContributors(parsed.owner, parsed.repo).then((list) => {
          if (!cancelled) setContributors(list);
        });

        fetchBranches(parsed.owner, parsed.repo).then((list) => {
          if (!cancelled) setBranches(list.filter((b) => b.name !== repoMeta.defaultBranch));
        });

        fetchCommitActivity(parsed.owner, parsed.repo).then((weeks) => {
          if (!cancelled) setPulse(weeks);
        });

        const targets = cityData.buildings.slice(0, MAX_ACTIVITY_BUILDINGS);
        if (targets.length > 0) {
          setActivityLoading(true);
          Promise.all(
            targets.map(async (b) => {
              const raw = await fetchPathActivity(parsed.owner, parsed.repo, b.name);
              return [b.id, { ...raw, level: classifyActivity(raw) }] as const;
            })
          ).then((results) => {
            if (cancelled) return;
            const next: Record<string, BuildingActivity> = {};
            for (const [id, a] of results) next[id] = a;
            setActivity(next);
            setActivityLoading(false);
          });
        }

        const folderNames = cityData.buildings.filter((b) => b.kind === "folder").map((b) => b.name);
        if (folderNames.length > 0) {
          setEdgesLoading(true);
          buildDependencyEdges(parsed.owner, parsed.repo, repoMeta.defaultBranch, tree.items, folderNames)
            .then((result) => {
              if (!cancelled) setEdges(result.edges);
            })
            .finally(() => {
              if (!cancelled) setEdgesLoading(false);
            });
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repoParam]);

  async function handleCompareBranch(branchName: string) {
    setCompareBranch(branchName);
    setPrDiff({});
    setActivePr(null);
    if (!branchName) {
      setMode("structure");
      setCompareDiff({});
      return;
    }
    const parsed = parseRepoInput(repoParam);
    if (!parsed || baseTreeItems.length === 0) return;
    setCompareLoading(true);
    try {
      const compareTree = await fetchRepoTree(parsed.owner, parsed.repo, branchName);
      setCompareDiff(buildBranchDiff(baseTreeItems, compareTree.items));
      setMode("compare");
    } catch {
      setCompareBranch("");
    } finally {
      setCompareLoading(false);
    }
  }

  async function handlePrPreview() {
    const num = parseInt(prInput, 10);
    if (!num || num <= 0) {
      setPrError("Enter a valid PR number.");
      return;
    }
    const parsed = parseRepoInput(repoParam);
    if (!parsed) return;
    setPrLoading(true);
    setPrError("");
    setCompareBranch("");
    setCompareDiff({});
    try {
      const files = await fetchPRFiles(parsed.owner, parsed.repo, num);
      setPrDiff(buildPRDiff(files));
      setActivePr(num);
      setMode("pr");
    } catch (err) {
      setPrError(err instanceof Error ? err.message : "Couldn't load that PR.");
    } finally {
      setPrLoading(false);
    }
  }

  function resetToStructure() {
    setMode("structure");
    setCompareBranch("");
    setCompareDiff({});
    setPrDiff({});
    setActivePr(null);
    setPrInput("");
  }

  const activeDiff = mode === "compare" ? compareDiff : mode === "pr" ? prDiff : {};

  return (
    <div className="city-page">
      <div className="wrap city-topbar">
        <button className="btn btn-ghost" onClick={() => router.push("/")}>
          ← Back
        </button>
        {meta && (
          <div className="city-meta">
            <span className="display city-title">
              {meta.owner}/{meta.repo}
            </span>
            {meta.description && <span className="city-desc">{meta.description}</span>}
          </div>
        )}

        {status === "ready" && (
          <div className="mode-toggle">
            <button className={`mode-btn ${mode === "structure" ? "active" : ""}`} onClick={resetToStructure}>
              Structure
            </button>
            <button
              className={`mode-btn ${mode === "heatmap" ? "active" : ""}`}
              disabled={activityLoading && Object.keys(activity).length === 0}
              onClick={() => setMode("heatmap")}
            >
              {activityLoading && Object.keys(activity).length === 0 ? "Heatmap…" : "Heatmap"}
            </button>
            <button
              className={`mode-btn road-btn ${showRoads ? "active" : ""}`}
              disabled={edgesLoading && edges.length === 0}
              onClick={() => setShowRoads((v) => !v)}
              title="Toggle dependency roads"
            >
              {edgesLoading && edges.length === 0 ? "Roads…" : "Roads"}
            </button>
            {meta && city && (
              <button className="mode-btn ai-btn" onClick={() => setTourOpen(true)}>
                AI Tour
              </button>
            )}
          </div>
        )}
      </div>

      {status === "loading" && (
        <div className="city-status">
          <div className="city-status-inner mono">Fetching {repoParam} from GitHub…</div>
        </div>
      )}

      {status === "error" && (
        <div className="city-status">
          <div className="city-status-inner mono error">{error}</div>
          <button className="btn btn-primary" onClick={() => router.push("/")}>
            Try another repo
          </button>
        </div>
      )}

      {status === "ready" && city && (
        <>
          <div className="wrap city-stats">
            <div className="stat">
              <span className="stat-num mono">{city.stats.totalFiles.toLocaleString()}</span>
              <span className="stat-label">files</span>
            </div>
            <div className="stat">
              <span className="stat-num mono">{city.stats.totalFolders.toLocaleString()}</span>
              <span className="stat-label">folders</span>
            </div>
            <div className="stat">
              <span className="stat-num mono">{city.stats.topLevelItems}</span>
              <span className="stat-label">buildings</span>
            </div>
            {meta && (
              <div className="stat">
                <span className="stat-num mono">★ {meta.stars.toLocaleString()}</span>
                <span className="stat-label">stars</span>
              </div>
            )}
            {city.stats.truncated && <div className="stat-note mono">Large repo — showing a partial tree</div>}
          </div>

          <div className="wrap city-controls">
            <div className="control-group">
              <span className="control-label mono">Compare branch</span>
              <select
                className="control-select"
                value={compareBranch}
                onChange={(e) => handleCompareBranch(e.target.value)}
                disabled={compareLoading || branches.length === 0}
              >
                <option value="">{branches.length === 0 ? "no other branches" : "none"}</option>
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              {compareLoading && <span className="control-hint mono">loading…</span>}
            </div>

            <div className="control-group">
              <span className="control-label mono">PR preview</span>
              <input
                className="control-input"
                placeholder="PR number"
                value={prInput}
                onChange={(e) => setPrInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePrPreview()}
              />
              <button className="btn btn-ghost control-btn" onClick={handlePrPreview} disabled={prLoading}>
                {prLoading ? "…" : activePr ? `#${activePr} ✓` : "Preview"}
              </button>
              {prError && <span className="control-hint mono error">{prError}</span>}
            </div>
          </div>

          <div className="city-canvas-wrap">
            <City3D data={city} mode={mode} activity={activity} diff={activeDiff} edges={edges} showRoads={showRoads} />
          </div>

          <div className="wrap city-legend-note mono">
            {mode === "structure" && (
              <>
                <span className="dot-legend" style={{ background: "#5EEAD4" }} /> folder&nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#FFB454" }} /> root file&nbsp;&nbsp; height = file count
              </>
            )}
            {mode === "heatmap" && (
              <>
                <span className="dot-legend" style={{ background: "#4ADE80" }} /> recent&nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#FACC15" }} /> moderate&nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#FF6B6B" }} /> very active&nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#4B5563" }} /> dead&nbsp;&nbsp; top {MAX_ACTIVITY_BUILDINGS} buildings only
              </>
            )}
            {(mode === "compare" || mode === "pr") && (
              <>
                <span className="dot-legend" style={{ background: "#4ADE80" }} /> added&nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#FF6B6B" }} /> removed&nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#60A5FA" }} /> modified&nbsp;&nbsp;
                {mode === "compare" ? "dimmed = unchanged vs default branch" : `dimmed = untouched by PR #${activePr}`}
              </>
            )}
            {showRoads && (
              <>
                &nbsp;&nbsp;·&nbsp;&nbsp;<span className="dot-legend" style={{ background: "#5EEAD4" }} /> road = detected import
              </>
            )}
            &nbsp;&nbsp;·&nbsp;&nbsp; drag to orbit, scroll to zoom
          </div>

          {pulse && (
            <div className="wrap">
              <PulseChart weeks={pulse} />
            </div>
          )}

          <div className="wrap">
            <ContributorRow contributors={contributors} />
          </div>

          {meta && <AiTourPanel meta={meta} city={city} open={tourOpen} onClose={() => setTourOpen(false)} />}
        </>
      )}
    </div>
  );
}
