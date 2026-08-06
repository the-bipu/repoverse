"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchRepoMeta, fetchRepoTree, parseRepoInput, type RepoMeta } from "@/lib/github";
import { buildCityFromTree, type CityData } from "@/lib/buildCity";
import City3D from "@/components/City3D";

type Status = "loading" | "error" | "ready";

export default function CityPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const repoParam = params.get("repo") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [city, setCity] = useState<CityData | null>(null);

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

    (async () => {
      try {
        const repoMeta = await fetchRepoMeta(parsed.owner, parsed.repo);
        const tree = await fetchRepoTree(parsed.owner, parsed.repo, repoMeta.defaultBranch);
        if (cancelled) return;
        setMeta(repoMeta);
        setCity(buildCityFromTree(tree.items, tree.truncated));
        setStatus("ready");
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
            <City3D data={city} />
          </div>

          <div className="wrap city-legend-note mono">
            <span className="dot-legend" style={{ background: "#5EEAD4" }} /> folder
            &nbsp;&nbsp;
            <span className="dot-legend" style={{ background: "#FFB454" }} /> root file
            &nbsp;&nbsp; height = file count · drag to orbit, scroll to zoom
          </div>
        </>
      )}
    </div>
  );
}
