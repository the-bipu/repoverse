"use client";

import { useState } from "react";
import type { CityData } from "@/lib/buildCity";
import type { RepoMeta } from "@/lib/github";

interface Props {
  meta: RepoMeta;
  city: CityData;
  open: boolean;
  onClose: () => void;
}

type State = "idle" | "loading" | "error" | "done";

export default function AiTourPanel({ meta, city, open, onClose }: Props) {
  const [state, setState] = useState<State>("idle");
  const [tour, setTour] = useState("");
  const [error, setError] = useState("");

  async function runTour() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: meta.owner,
          repo: meta.repo,
          description: meta.description,
          topFolders: city.buildings.slice(0, 12).map((b) => ({ name: b.name, kind: b.kind, fileCount: b.fileCount })),
          stats: city.stats,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setTour(data.tour as string);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (!open) return null;

  return (
    <div className="tour-overlay" onClick={onClose}>
      <div className="tour-panel" onClick={(e) => e.stopPropagation()}>
        <div className="tour-panel-head">
          <span className="display tour-title">AI Tour</span>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        {state === "idle" && (
          <div className="tour-body">
            <p className="tour-intro">
              Get a short, guided walkthrough of {meta.owner}/{meta.repo} — where to
              start, and what each major district is likely for.
            </p>
            <button className="btn btn-primary" onClick={runTour}>Start the tour</button>
          </div>
        )}

        {state === "loading" && (
          <div className="tour-body">
            <span className="mono tour-loading">Walking the city…</span>
          </div>
        )}

        {state === "error" && (
          <div className="tour-body">
            <span className="mono tour-error">{error}</span>
            <button className="btn btn-ghost" onClick={runTour} style={{ marginTop: 12 }}>
              Try again
            </button>
          </div>
        )}

        {state === "done" && (
          <div className="tour-body tour-text">
            {tour.split("\n").filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
