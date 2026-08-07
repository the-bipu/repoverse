"use client";

import { useMemo, useState } from "react";
import type { WeeklyCommits } from "@/lib/github";

/**
 * "Time Machine, lite": scrubbing through 52 weeks of commit volume. A full
 * time machine (the city's shape changing week by week) would need one API
 * call per week just to rebuild the tree — this uses the one commit_activity
 * call GitHub already aggregates for you instead.
 */
export default function PulseChart({ weeks }: { weeks: WeeklyCommits[] }) {
  const [index, setIndex] = useState(weeks.length - 1);
  const max = useMemo(() => Math.max(1, ...weeks.map((w) => w.total)), [weeks]);

  if (weeks.length === 0) return null;
  const active = weeks[index];
  const label = active
    ? new Date(active.weekStart * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className="pulse-chart">
      <div className="pulse-head">
        <span className="pulse-label mono">Pulse — commits per week (last 52 weeks)</span>
        <span className="pulse-value mono">
          {active?.total ?? 0} commit{active?.total === 1 ? "" : "s"} · week of {label}
        </span>
      </div>
      <div className="pulse-bars">
        {weeks.map((w, i) => (
          <div
            key={w.weekStart}
            className={`pulse-bar ${i === index ? "active" : ""}`}
            style={{ height: `${Math.max(3, (w.total / max) * 100)}%` }}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={weeks.length - 1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        className="pulse-slider"
      />
    </div>
  );
}
