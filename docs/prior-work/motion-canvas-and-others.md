# Motion Canvas and other explanatory animation libraries

We have two needs: (1) render **explainer videos** of split data and Monte-Carlo results, and (2) show **in-browser animations inside a vanilla-JS, no-build PWA** that load from a CDN or a vendored ES module and work offline. ManimCE covers (1) (see `manim.md`). This note ranks the rest.

Checked 2026-11-03 (GitHub API, npm registry).

| Library | URL | License | Maturity | Fit |
|---|---|---|---|---|
| Motion Canvas | https://github.com/motion-canvas/motion-canvas, https://motion-canvas.github.io, npm `@motion-canvas/core` 3.17.2 | MIT | 19.7k stars, pushed 2026-07-02 | TS generator-based scenes plus a Vite editor with a timeline, made for voice-over sync. Great for authored explainer videos. Needs a Vite build, so it doesn't drop into a no-build PWA, but you can export video or a player bundle. |
| Revideo | https://github.com/midrender/revideo (was redotvideo/revideo), npm `@revideo/core` 0.11.0 | MIT | 4.2k stars, pushed 2026-07-15 | Motion Canvas fork with a **headless render API** and a React player. Best for "render MP4 from JSON in Node/CI" in TypeScript. |
| Remotion | https://github.com/remotion-dev/remotion, npm `remotion` 4.0.540 | **Remotion License** (source-available. Free for individuals, ≤3-employee companies and non-profits. Company licence otherwise.) | 70k stars, pushed 2026-11-03 | React to video, with a mature Lambda/SSR render. Overkill, and it brings in React plus a licence condition. |
| Reanimate | https://github.com/reanimate/reanimate | Unlicense | 1.2k stars, last push 2025-02-06 | Haskell SVG animation. Elegant, but there is no Haskell in our stack. Reference only. |
| Penrose | https://github.com/penrose/penrose, npm `@penrose/core` 3.3.1 | MIT | 8k stars, pushed 2026-10-31 | Diagrams from notation via constraint optimisation. Good for a static route/graph diagram (route DAG), not timelines. |
| Theatre.js | https://github.com/theatre-js/theatre, npm `@theatre/core` 0.7.2 | core Apache-2.0, **studio AGPL-3.0** | 12.8k stars, last push 2024-08-14 | Keyframe editor for web/Three.js. Stalled. Studio is AGPL. Skip. |
| Animotion | https://github.com/animotionjs/animotion | MIT | 1.8k stars, pushed 2026-07-23 | Svelte presentation framework (code/morph animations). Needs a build. Use only for a talk deck. |
| anime.js | https://github.com/juliangarnier/anime, npm `animejs` 4.5.0 | MIT | 74k stars, pushed 2026-11-02 | Small tween/timeline engine. **ES module from CDN, no build.** Drives SVG/DOM, with a seekable timeline. Best fit for in-app explainers synced to our run clock. |
| p5.js | https://github.com/processing/p5.js, npm `p5` 2.3.4 | **LGPL-2.1** | 24k stars, pushed 2026-11-03 | Canvas sketches, no build. LGPL is fine unmodified from a CDN. Heavier, and its own draw loop. Okay for MC "dots falling into histogram". |
| Observable Plot | https://github.com/observablehq/plot, npm `@observablehq/plot` 0.6.17 | ISC | 5.4k stars, pushed 2026-11-02 | Declarative SVG charts, ESM from CDN. No built-in transitions. Animate by re-rendering per frame or by tweening the data with anime.js. Excellent for histograms and CDFs of MC output. |
| Vizzu | https://github.com/vizzuhq/vizzu-lib, npm `vizzu` 0.18.0 | Apache-2.0 | 2k stars, pushed 2026-04-20 | **Animated chart-to-chart transitions** (bar→stacked→pie) out of the box, ESM/WASM from CDN. Ideal for "where each record's time goes per split" story steps. |
| Idyll | https://github.com/idyll-lang/idyll | MIT | 2k stars, last push 2023-02-04 | Markup for scrollytelling essays. Dormant. Skip. |
| Manim Slides / manim-web | see `manim.md` | MIT | - | HTML export of Manim scenes / TS Manim port |
| Matplotlib `animation` | https://matplotlib.org/stable/api/animation_api.html | Matplotlib licence (PSF-style, BSD-compatible) | Mature | Quick FuncAnimation GIF/MP4 from Python. Fine for one-off analysis clips. Less polished than Manim. |

## Recommendation
- **Rendered explainer videos:** keep ManimCE (already in place). If we later want a TS pipeline next to the JS model (`scripts/analysis/*.mjs`, so no JSON hop), use **Revideo** (headless, MIT).
- **In-app, interactive, offline:** **anime.js + Observable Plot** (both MIT/ISC ESM, no build). Add **Vizzu** for story-style chart transitions. These can be vendored into `js/vendor/` and precached by the service worker.

## Mapping onto our layers

| Layer | Best tool | Use |
|---|---|---|
| Sense | - | - |
| Know | Observable Plot | MC histograms, CDF of P(sub-6:50), per-split distributions from `data/kb/analysis/simulate.json` |
| Decide | Vizzu / anime.js | Animate the reset-threshold decision: scrub the threshold, and watch expected attempts-to-WR update |
| Show & Compete | anime.js timeline bound to the Race the WR run clock | Bars/ghost lanes move in lock-step with the videos. Revideo/ManimCE for shareable MP4s. |
| SMILE sangha | Revideo headless render | An agent renders the "today's session" recap video from feed data |
| Handover | Motion Canvas editor | Human tweaks timing in the editor, the agent regenerates the data layer |
| Knowledge base | Penrose | Static route DAG / mechanics diagrams in the wiki |

## Integration steps
1. Vendor `animejs@4.5.0` and `@observablehq/plot@0.6.17` (and its `d3` dependency) as ESM under `js/vendor/`, and add them to the service-worker precache. CDN fallback via cdn.jsdelivr.net.
2. `js/lib/explain.js`: `renderMcHistogram(el, simulateJson)` with Plot. `animateRace(el, runs, clock)`, where an anime.js timeline is `seek()`ed from the existing run clock in `sync.js`.
3. Add an "Explain" panel to HQ: three steps (sum of best → target pace → P(sub-6:50) per route), with Vizzu transitions between them.
4. Optional: `scripts/video/` Revideo project reading the same `animation-data.json` that ManimCE uses, if TypeScript-native rendering is wanted.

## Risks
- Remotion's licence and Theatre Studio's AGPL make both poor fits. Avoid them.
- Plot pulls in d3 (about 250 KB). Vizzu ships WASM (about 1 MB). Lazy-load them on the Explain panel only.
- Motion Canvas and Revideo need Node/Vite tooling outside the no-build app. Keep them in `scripts/`.
- p5.js is LGPL. If it is ever modified and bundled, the LGPL obligations apply. Prefer unmodified CDN use.
