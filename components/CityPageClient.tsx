"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchRepoMeta,
  fetchRepoTree,
  fetchContributors,
  fetchPathActivity,
  parseRepoInput,
  type RepoMeta,
  type Contributor,
} from "@/lib/github";
import {
  buildCityFromTree,
  classifyActivity,
  MAX_ACTIVITY_BUILDINGS,
  type CityData,
  type BuildingActivity,
} from "@/lib/buildCity";
import City3D, { type CityMode } from "@/components/City3D";
import ContributorRow from "@/components/ContributorRow";

type Status = "loading" | "error" | "ready";

export default function CityPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const repoParam = params.get("repo") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [city, setCity] = useState<CityData | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [activity, setActivity] = useState<Record<string, BuildingActivity>>({});
  const [activityLoading, setActivityLoading] = useState(false);
  const [mode, setMode] = useState<CityMode>("structure");

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
    setMode("structure");

    (async () => {
      try {
        const repoMeta = await fetchRepoMeta(parsed.owner, parsed.repo);
        const tree = await fetchRepoTree(parsed.owner, parsed.repo, repoMeta.defaultBranch);
        if (cancelled) return;

        const cityData = buildCityFromTree(tree.items, tree.truncated);
        setMeta(repoMeta);
        setCity(cityData);
        setStatus("ready");

        // Contributors — one call, load in the background.
        fetchContributors(parsed.owner, parsed.repo).then((list) => {
          if (!cancelled) setContributors(list);
        });

        // Activity — one call per top-N building, fired after the city is
        // already visible so structure mode never waits on this.
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
            <button
              className={`mode-btn ${mode === "structure" ? "active" : ""}`}
              onClick={() => setMode("structure")}
            >
              Structure
            </button>
            <button
              className={`mode-btn ${mode === "heatmap" ? "active" : ""}`}
              disabled={activityLoading && Object.keys(activity).length === 0}
              onClick={() => setMode("heatmap")}
            >
              {activityLoading && Object.keys(activity).length === 0 ? "Heatmap…" : "Heatmap"}
            </button>
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
            {city.stats.truncated && (
              <div className="stat-note mono">Large repo — showing a partial tree</div>
            )}
          </div>

          <div className="city-canvas-wrap">
            <City3D data={city} mode={mode} activity={activity} />
          </div>

          <div className="wrap city-legend-note mono">
            {mode === "structure" ? (
              <>
                <span className="dot-legend" style={{ background: "#5EEAD4" }} /> folder
                &nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#FFB454" }} /> root file
                &nbsp;&nbsp; height = file count
              </>
            ) : (
              <>
                <span className="dot-legend" style={{ background: "#4ADE80" }} /> recent
                &nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#FACC15" }} /> moderate
                &nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#FF6B6B" }} /> very active
                &nbsp;&nbsp;
                <span className="dot-legend" style={{ background: "#4B5563" }} /> dead
                &nbsp;&nbsp; top {MAX_ACTIVITY_BUILDINGS} buildings only
              </>
            )}
            &nbsp;&nbsp;·&nbsp;&nbsp; drag to orbit, scroll to zoom
          </div>

          <div className="wrap">
            <ContributorRow contributors={contributors} />
          </div>
        </>
      )}
    </div>
  );
}
