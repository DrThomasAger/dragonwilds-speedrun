# Route optimisers, sum of best, ghosts, TAS tools

This covers prior work on: (a) comparisons computed from split history (sum of best, balanced/theory pace), (b) "ghost" racing against a previous run or video, and (c) route planning and TAS tooling. We already have a community sum of best (6:38), a 6:48 target pace, Race the WR (multi-video sync, split-aligned mode), and a Monte-Carlo reset-policy model (`scripts/analysis/`).

Checked 2026-11-03.

| Item | URL | License | Maturity |
|---|---|---|---|
| livesplit-core comparison generators (`src/comparison/`: average_segments, balanced_pb, best_segments, best_split_times, latest_run, median_segments, worst_segments, plus `goal.rs`, which balances any goal time via a skill curve over history) | https://github.com/LiveSplit/livesplit-core/tree/master/src/comparison | Apache-2.0 OR MIT | Active (pushed 2026-11-02). Reference implementations. |
| LiveSplit "Balanced PB" (built in) | https://github.com/LiveSplit/LiveSplit | MIT | Stable. Distributes a goal time across segments using segment history. |
| TheoryComparisonGenerator | https://github.com/fmichea/LiveSplit.TheoryComparisonGenerator | no license | 7 stars, last push 2023-12-07. Generates splits for an achievable goal time. Same idea as our `targetPace`. |
| SplitScreen (side-by-side video segment comparison) | https://github.com/tp971/splitscreen-gui | MIT | 0 stars, last push 2022-03-15. Java + GStreamer. Abandoned, but the closest prior art to Race the WR "split-aligned". |
| therun.gg stats (PB chance, golds, distributions) | https://therun.gg | MIT frontend | See `splits-io-therun-gg.md` |
| Radeline (Celeste TAS input optimiser, random/sequential search + movement sim) | https://github.com/Kataiser/radeline | MIT | 8 stars, pushed 2025-05-02 |
| CelesteTAS / Celeste Studio | https://github.com/EverestAPI/CelesteTAS-EverestInterop, https://tasvideos.org/GameResources/Windows/Celeste | MIT | 85 stars, pushed 2026-08-25. Community standard for Celeste, runs on the Everest mod loader. The original clementgallet/CelesteTAS has been dormant since 2020. |
| libTAS (Linux TAS tool for native games) | https://github.com/clementgallet/libTAS | GPL-3.0 | 598 stars, pushed 2026-10-27. Linux only. Not for UE5 on Windows. |
| "Automating Speedrun Routing: Overview and Vision" (Groß, Zühlke, Naujoks; EvoApplications 2022) | https://arxiv.org/abs/2106.01182 | arXiv | Survey/vision. Graph models of a run and fit of metaheuristics/EAs. |

No general-purpose "route optimiser" library for speedruns exists. Routing is done per game, by hand or with small TSP/graph scripts. Ghost features in LiveSplit are comparisons (numbers), not video. The video ghost is ours (Race the WR).

## Mapping onto our layers

| Layer | Prior work | Take for us |
|---|---|---|
| Sense | - | - |
| Know | Comparison generators over segment history | Port Median Segments and goal/Balanced PB (`goal.rs` skill curve), plus a PB-chance estimate from our MC model, to `js/lib/` (pure JS, about 100 lines) over our Timer history and imported `.lss`. |
| Decide | Balanced PB / Theory comparison; routing paper's graph model | Our route is a 5-node chain with skip *variants* per node (`routeVariants`). Model it as a DAG with (mean, var, success p) per edge and pick the variant set that maximises P(time < 6:50) **with the reset policy**. The MC model already does this by enumeration; the paper's framing names it. |
| Show & Compete | SplitScreen side-by-side, LiveSplit comparisons | Race the WR already exceeds SplitScreen. Add a "ghost = Balanced 6:48" virtual runner (no video, just a moving bar) to the race. |
| SMILE sangha | - | An "optimiser" agent reruns `simulate.mjs` when new runs arrive and posts the best variant set to the feed. |
| Handover | TAS = full auto, RTA = manual | Not applicable to RTA verification. Use TAS-like tooling only for practice analysis. |
| Knowledge base | TASVideos game resource pages | Our Mechanics wiki plays that role. Link each skip to its frame-level evidence. |

## Integration steps
1. `js/lib/comparisons.js`: `bestSegments`, `medianSegments`, `goalComparison(goal)` (port of livesplit-core `goal.rs`: find the common percentile across each segment's history whose sum hits the goal; Balanced PB = goal of PB), `pbChance` (from the MC model). Unit-test against livesplit-core outputs on one `.lss`.
2. Export them as extra `.lss` comparisons in `exportLss` (they already support `comparisons[]`).
3. Add a "Target 6:48 (balanced)" lane in Race the WR that renders a synthetic progress bar on the shared run clock.
4. In `scripts/analysis/`, write the route as an explicit DAG JSON (`data/kb/route-graph.json`) so other agents and the KB can reason over it. Keep the enumeration solver because the search space is tiny.

## Risks
- Small data: two or three reference runs make median/balanced comparisons noisy. Label sample size.
- TAS tools don't apply to a UE5 online-capable Windows game. Don't spend time there.
