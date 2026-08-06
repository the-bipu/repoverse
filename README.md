# RepoVerse — v1 (Homepage)

Drop these files into `the-bipu/nextjs-starters` (App Router + TypeScript):

```
app/layout.tsx
app/page.tsx
app/globals.css
components/Skyline.tsx
```

Then:

```bash
npm install
npm run dev
```

## What's in v1
Landing page only, per the RepoVerse Phase 1 scope:
- Hero with a live animated canvas skyline (the product's core metaphor, not a screenshot)
- Problem → solution comparison (folder tree vs. bar-chart districts)
- Repo→city legend
- Feature grid (heatmap, time machine, contributor mode, dependency roads, AI tour, PR preview)
- 5-phase roadmap
- CTA

## Not in v1 (later phases)
Actual repo parsing, the 3D city renderer (three.js / R3F), GitHub API integration,
AI tour, and everything else in Phases 2-5 of the roadmap. The input field is wired
to local state only — submitting it doesn't do anything yet.

## Design tokens
- Base `#0B0E14`, elevated `#12161F`, surface `#171D2B`, border `#262D3D`
- Amber `#FFB454` = activity/commits, Teal `#5EEAD4` = data/roads, Red `#FF6B6B` reserved for heatmap
- Display: Bricolage Grotesque · Body: Inter · Data/labels: IBM Plex Mono
