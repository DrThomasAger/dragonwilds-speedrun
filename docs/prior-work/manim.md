# Manim (3b1b ManimGL and Manim Community)

Manim is the Python engine 3Blue1Brown uses for explainer videos. It comes in two lines:
- **ManimGL** (`3b1b/manim`, PyPI `manimgl`) is Grant Sanderson's own fork, rendered with OpenGL and run interactively (`manimgl file.py Scene -se`).
- **Manim Community / ManimCE** (`ManimCommunity/manim`, PyPI `manim`) is the community fork. It has docs, tests, a stable API and Cairo plus an OpenGL renderer.

**We render with ManimCE 0.22.1** (venv `D:/claude-temp/prior/venvs/manim`, Python 3.13, no LaTeX: every label is `Text`). `scripts/animations/export-data.mjs` dumps `data/kb/prior/animation-data.json` from `js/data/raid.js` and the Monte-Carlo model (`scripts/analysis/model.mjs`, read in memory). Three scenes read it: `race_to_650.py` (RaceTo650), `sum_of_best.py` (SumOfBest) and `monte_carlo.py` (MonteCarlo). `bash scripts/animations/render.sh` renders all three at 720p30 to `media/animations/*.mp4` and makes a 640px GIF preview of each.

Checked 2026-11-03 (GitHub API, PyPI).

| Project | URL | License | Maturity |
|---|---|---|---|
| ManimGL (3b1b) | https://github.com/3b1b/manim, PyPI `manimgl` 1.7.2 | MIT | 96k stars, pushed 2026-09-09. Driven by one author's needs. Thin docs. API changes without notice. |
| Manim Community (ManimCE) | https://github.com/ManimCommunity/manim, https://docs.manim.community, PyPI `manim` 0.22.1 | MIT | 42k stars, pushed 2026-11-02. Releases, docs, Discord. Pre-1.0, so minor versions can break. |
| Manim Slides | https://github.com/jeertmans/manim-slides, PyPI 5.7.0 | MIT | 974 stars, pushed 2026-11-02. Turns ManimCE/ManimGL scenes into slide decks and exports **HTML (reveal.js)**. |
| ManimML | https://github.com/helblazer811/ManimML | MIT | 3.5k stars, last push 2024-06-22. ML architecture animations. Stale. Not needed. |
| reactive-manim | https://github.com/philip-murray/reactive-manim | MIT | Pushed 2026-08-31. Component-style equations for ManimCE. Niche. |
| manim-web (TypeScript port, browser) | https://github.com/maloyan/manim-web, npm `manim-web` 0.40.1 | MIT | 509 stars, pushed 2026-10-25. Canvas/WebGL + Three.js, KaTeX/MathJax, near-Python API, `py2ts` converter. HN users reported flicker and fuzzy text (https://news.ycombinator.com/item?id=47155375). Young. |
| Manim.js (p5.js replica) | https://github.com/JazonJiao/Manim.js | no license | 454 stars. Old core (2021). Avoid (no license). |

## ManimGL vs ManimCE for us
- ManimCE wins on reproducible headless renders (`manim -qm ... --media_dir D:/claude-temp/...`), on docs, and on a stable `Axes`/`BarChart`/`ValueTracker` API. It is the right pick for CI-rendered explainer clips of split data and MC distributions.
- ManimGL wins for live interactive scrubbing while authoring, but its code doesn't port 1:1 to CE (different imports, `ShowCreation` vs `Create`, config). Don't mix the two.

## Mapping onto our layers

| Layer | Manim offers | Take for us |
|---|---|---|
| Sense | - | - |
| Know | Data-driven scenes from JSON | `animation-data.json` is the single source. Scenes never hard-code times, so re-renders track new runs. |
| Decide | Visual argument for a decision | Animate the reset-threshold DP: "reset if Vines > X" with the MC histogram shifting. |
| Show & Compete | Polished MP4/GIF/WebM, slides | Race-to-6:50 bars, sum-of-best composite, P(sub-6:50) vs route variant. Embed the WebM in the PWA (HQ, Route) as static assets. |
| SMILE sangha | CLI renders run by an agent | The animation agent re-renders on data change (hash of the JSON) and posts a thumbnail to the feed. |
| Handover | - | Human edits a scene, the agent re-renders all of them. |
| Knowledge base | Rendered media with provenance | Store `media/animations/*.webm` next to a sidecar JSON (data hash, commit, ManimCE version). |

## Integration steps (beyond what the other agent is doing)
1. Pin `manim==0.22.1` in a `requirements-anim.txt`. Render with `--format webm` (VP9, small, plays inline in Chromium PWAs) plus a poster PNG.
2. Use Manim Slides `manim-slides convert --to html` for a talk/explainer deck that works offline inside the PWA (reveal.js is static HTML).
3. Add the sidecar provenance JSON and have the service worker cache the media lazily, not precache it (size).
4. For *interactive* in-app versions of the same scenes, use the browser libraries in `motion-canvas-and-others.md` rather than manim-web for now.

## Risks
- Rendering needs Python, ffmpeg, and LaTeX for `MathTex` (or use `Text` only). It is heavy on CI. Keep renders local or in a cached Action.
- Pre-1.0 API drift in ManimCE. Pin the version.
- The output is video, not interactive. The PWA's offline cache size grows. Keep clips short (≤20 s, ≤2 MB).
- manim-web is promising but immature. Re-check in 6 months.
