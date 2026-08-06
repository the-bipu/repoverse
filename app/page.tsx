"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Skyline from "@/components/Skyline";
import { parseRepoInput } from "@/lib/github";

const LEGEND: [string, string][] = [
  ["Root folder", "City"],
  ["Folder", "District"],
  ["File", "Building"],
  ["Lines of code", "Building height"],
  ["Commits", "Building lights"],
  ["Contributors", "Citizens"],
  ["Dependencies", "Roads"],
  ["Branches", "Parallel cities"],
];

const FEATURES = [
  {
    tag: "Explore",
    title: "Heatmap mode",
    body: "Color every building by how alive it is — green for recent work, red for churn, gray for code nobody's touched in years.",
  },
  {
    tag: "Explore",
    title: "Time machine",
    body: "Drag a slider from a repo's first commit to today and watch the skyline grow, one building at a time.",
  },
  {
    tag: "Explore",
    title: "Contributor mode",
    body: "See who owns what. Every contributor gets an avatar that walks the districts they've actually written.",
  },
  {
    tag: "Understand",
    title: "Dependency roads",
    body: "Imports become roads between buildings. Width scales with how often a module gets pulled in — the busiest streets matter most.",
  },
  {
    tag: "Understand",
    title: "AI tour",
    body: "Ask 'explain this repo' and get a walking route through the architecture, starting where a new contributor actually should.",
  },
  {
    tag: "Ship",
    title: "PR preview",
    body: "Open a pull request and only the changed buildings light up — added in teal, removed in red, modified in amber.",
  },
];

const PHASES: [string, string, string][] = [
  ["01", "Foundation", "Import a repo, parse the file tree, render the first city, basic search."],
  ["02", "Signal", "Dependency roads, commit activity, heatmaps, contributor citizens."],
  ["03", "Intelligence", "AI tour, architecture detection, learning mode, time machine, branch diffing."],
  ["04", "Teams", "Private repos, org dashboards, ownership analytics, CI hooks."],
  ["05", "Everywhere", "VS Code extension, desktop app, repo health scoring, multi-repo workspaces."],
];

const QUICK_REPOS = ["facebook/react", "vercel/next.js", "vuejs/core", "nodejs/node", "torvalds/linux"];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notReady(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }

  function goToCity(repo: string) {
    const parsed = parseRepoInput(repo);
    if (!parsed) {
      notReady("Enter a valid GitHub repo, like owner/repo");
      return;
    }
    router.push(`/city?repo=${parsed.owner}/${parsed.repo}`);
  }

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}
      <div className="wrap">
        <nav className="nav">
          <div className="brand display">
            <span className="brand-mark" />
            RepoVerse
          </div>
          <div className="nav-links">
            <a href="#legend">Product</a>
            <a href="#features">Features</a>
            <a href="#roadmap">Roadmap</a>
            <button className="btn btn-ghost" onClick={() => notReady("Sign-in isn't built yet")}>
              Sign in
            </button>
            <p className="btn btn-primary">
              Visualize a repo
            </p>
          </div>
        </nav>
      </div>

      <div className="hero">
        <div className="wrap hero-inner">
          <span className="eyebrow">
            <span className="dot" />
            v1 — City View is live
          </span>
          <h1 className="display">
            Every repository is a <em>city</em> you haven&apos;t visited yet.
          </h1>
          <p className="sub">
            RepoVerse turns a GitHub repo into an explorable 3D city — folders become
            districts, files become buildings, commits light the windows. Understand a
            codebase by walking through it, not by scrolling a file tree.
          </p>
          <form
            id="hero-repo-form"
            className="repo-form"
            onSubmit={(e) => {
              e.preventDefault();
              goToCity(url);
            }}
          >
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="github.com/facebook/react"
            />
            <button type="submit">Build the city</button>
          </form>
          <div className="quick-repos">
            {QUICK_REPOS.map((r) => (
              <button key={r} onClick={() => goToCity(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="skyline-wrap">
          <Skyline />
          <div className="skyline-fade" />
        </div>
      </div>

      <section id="problem">
        <div className="wrap">
          <div className="section-head">
            <span className="section-tag">The problem</span>
            <h2 className="display">A folder tree tells you nothing.</h2>
            <p>
              You open a new repo and get a wall of folder names. No sense of what&apos;s
              big, what&apos;s active, or where to actually start reading.
            </p>
          </div>
          <div className="compare">
            <div className="compare-card">
              <span className="label">// what you get today</span>
              <div className="tree-line">
                react/
                <br />
                &nbsp;&nbsp;<b>src/</b>
                <br />
                &nbsp;&nbsp;<b>packages/</b>
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;compiler/
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;fixtures/
                <br />
                &nbsp;&nbsp;<b>scripts/</b>
                <br />
                &nbsp;&nbsp;...
              </div>
            </div>
            <div className="compare-card">
              <span className="label">// what RepoVerse shows instead</span>
              <div className="bar-row">
                <span className="bar-label">components</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: "92%" }} />
                </div>
              </div>
              <div className="bar-row">
                <span className="bar-label">api</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: "68%" }} />
                </div>
              </div>
              <div className="bar-row">
                <span className="bar-label">utils</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: "40%" }} />
                </div>
              </div>
              <div className="bar-row">
                <span className="bar-label">hooks</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: "24%" }} />
                </div>
              </div>
              <div className="bar-row">
                <span className="bar-label">assets</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: "10%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="legend">
        <div className="wrap">
          <div className="section-head">
            <span className="section-tag">The idea</span>
            <h2 className="display">Everything in a repo has a place in the city.</h2>
            <p>
              This is the whole mapping. Once you know it, every city you open reads
              the same way — a lit window is a commit, a wide road is a heavily-used import.
            </p>
          </div>
          <div className="legend-grid">
            {LEGEND.map(([from, to]) => (
              <div className="legend-row" key={from}>
                <span className="from">{from}</span>
                <span className="to">{to}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features">
        <div className="wrap">
          <div className="section-head">
            <span className="section-tag">Inside the city</span>
            <h2 className="display">Six ways to read a codebase.</h2>
            <p>
              Each mode answers a different question — where&apos;s the risk, who owns
              this, what changed, where should a new contributor start.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <span className="ftag">{f.tag}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roadmap">
        <div className="wrap">
          <div className="section-head">
            <span className="section-tag">Roadmap</span>
            <h2 className="display">Five phases, in order.</h2>
            <p>
              Each phase ships as a usable product on its own — this isn&apos;t a
              five-year plan before anything works.
            </p>
          </div>
          <div className="phase-list">
            {PHASES.map(([num, title, body], i) => (
              <div className={`phase-row ${i === 0 ? "now" : ""}`} key={num}>
                <span className="p-num mono">{num}</span>
                <span className="p-title display">{title}</span>
                <span className="p-body">{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="cta-block">
            <h2 className="display">Paste a repo. Watch it become a city.</h2>
            <p>No install, no setup — RepoVerse reads the repo and builds the world in your browser.</p>
            <button
              className="btn btn-primary"
              style={{ padding: "12px 24px", fontSize: "15px" }}
              onClick={() => goToCity(url || QUICK_REPOS[0])}
            >
              Visualize your first repo →
            </button>
          </div>
        </div>
      </section>

      <footer>RepoVerse — explore the code, not just the commits.</footer>
    </div>
  );
}
