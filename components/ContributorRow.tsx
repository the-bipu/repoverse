"use client";

import type { Contributor } from "@/lib/github";

export default function ContributorRow({ contributors }: { contributors: Contributor[] }) {
  if (contributors.length === 0) return null;

  const max = contributors[0]?.contributions || 1;

  return (
    <div className="contributor-row">
      <span className="contributor-label mono">Citizens</span>
      <div className="contributor-list">
        {contributors.map((c) => (
          <a
            key={c.login}
            href={c.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="contributor-chip"
            title={`${c.login} — ${c.contributions} commits`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.avatarUrl} alt={c.login} className="contributor-avatar" />
            <span className="contributor-name">{c.login}</span>
            <span
              className="contributor-bar"
              style={{ width: `${Math.max(8, (c.contributions / max) * 32)}px` }}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
