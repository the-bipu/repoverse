<div align="center">

# 🏙️ RepoVerse

**Explore any GitHub repository as an interactive 3D city.**

Folders become districts. Files become buildings. Commits light the windows.
Understand a codebase by walking through it — not by scrolling a file tree.

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F%20v9-000000?logo=three.js&logoColor=white)](https://docs.pmnd.rs/react-three-fiber)
[![Status](https://img.shields.io/badge/status-v2.0.0-FFB454)]()
[![License](https://img.shields.io/badge/license-MIT-8892A6)]()

</div>

---

## What it does

Open a repo like React today and you get this:

```
react/
  src/
  packages/
    compiler/
    fixtures/
  scripts/
  ...
```

Just folder names. No sense of what's big, what's active, or where to start.

RepoVerse turns that same repo into a live 3D city — paste a URL, and every
top-level folder becomes a building sized by how much lives inside it.

| Repo item        | Becomes            |
| ----------------- | ------------------- |
| Root folder       | City                 |
| Folder            | District / Building  |
| File               | Building              |
| File count         | Building height      |
| Commits *(soon)*   | Building lights       |
| Contributors *(soon)* | Citizens          |
| Dependencies *(soon)* | Roads             |

---

## ✨ Current features (v2.0.0)

- 🌆 **Live city rendering** — paste any public GitHub repo (`owner/repo`, a full
  URL, with or without `.git`) or click a quick-launch chip, and RepoVerse fetches
  the real file tree from the GitHub API and renders it as a real React Three
  Fiber scene, right in the browser.
- 🔌 **No backend required** — GitHub's REST API is called client-side; no server,
  no auth, no setup beyond `npm install`.
- 🏗️ **Real generation logic** — top-level folders and root files become buildings,
  colored by kind (teal = folder, amber = file), height log-scaled by file count
  so one giant folder doesn't dwarf the skyline.
- 🖱️ **Interactive scene** — orbit, zoom, and hover any building for its name and
  file count.
- 📊 **Live stats bar** — total files, folders, buildings, and stars, computed from
  the actual fetch.
- ⚠️ **Real status handling** — loading, error (bad URL, 404, rate limit), and
  ready states, so a failed fetch never just shows a blank screen.
- 🎨 **A homepage that isn't a placeholder** — dark SaaS-style landing page with an
  animated canvas skyline hero, a problem/solution comparison, the repo→city
  legend, a feature grid, and the roadmap below — all wired to the live city view.

---

## 🧭 Try it

```bash
git clone https://github.com/the-bipu/repoverse.git
cd repoverse
npm install
npm run dev
```

Then open `http://localhost:3000`, paste a repo (or click a quick-launch chip),
and watch it build.

> **Rate limits:** GitHub's API allows 60 unauthenticated requests/hour per IP.
> Fine for trying it out, not for heavy use yet — token-based auth is on the roadmap.

---

## 🗂️ Project structure

```
app/
  page.tsx              — homepage (hero, features, roadmap)
  layout.tsx             — fonts + metadata
  globals.css            — design tokens & all styling
  city/
    page.tsx              — /city route (Suspense wrapper)

components/
  Skyline.tsx             — animated canvas skyline (homepage hero)
  City3D.tsx              — the actual 3D city (React Three Fiber)
  CityPageClient.tsx       — fetch → build → render state machine

lib/
  github.ts               — parse repo input, fetch repo meta + tree
  buildCity.ts             — flat GitHub tree → building layout
```

---

## 🎨 Design system

| Token | Value | Meaning |
| --- | --- | --- |
| `--bg` | `#0B0E14` | Base — midnight, not pure black |
| `--bg-elevated` | `#12161F` | Cards, panels |
| `--amber` | `#FFB454` | Activity, commits, root files |
| `--teal` | `#5EEAD4` | Data, roads, folders |
| `--red` | `#FF6B6B` | Reserved for heatmap mode |

**Type:** Bricolage Grotesque (display) · Inter (body) · IBM Plex Mono (data / stats)

---

## 🛣️ Roadmap

| Phase | Codename | Status | Ships |
| :---: | --- | :---: | --- |
| 01 | Foundation | ✅ Done | Landing page, repo import, first city, basic stats |
| 02 | Signal | 🚧 Next | Dependency roads, commit activity, heatmap mode, contributor citizens |
| 03 | Intelligence | ⏳ Planned | AI tour, architecture detection, time machine, branch diffing |
| 04 | Teams | ⏳ Planned | Private repos, org dashboards, ownership analytics, CI hooks |
| 05 | Everywhere | ⏳ Planned | VS Code extension, desktop app, health scoring, multi-repo workspaces |

---

## ⚠️ Known limitations

- No auth yet → 60 GitHub API requests/hour per IP.
- Buildings are top-level only — no nested districts, no LOC metric, no commit
  activity. That's Phase 2.
- Very large repos (100k+ tree entries) hit GitHub's tree API truncation limit;
  RepoVerse shows a note but doesn't paginate around it yet.
- No caching — revisiting a repo re-spends API quota.

---

## 🤝 Contributing

This is an early, actively-changing project — issues and PRs welcome, especially
around Phase 2 (dependency graph, commit activity, heatmaps).

## 📄 License

MIT