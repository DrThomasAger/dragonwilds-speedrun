# Prior work: agents in game worlds, speedrun tooling, explainer animation

What already exists that the Dragonwilds Raid Lab and the OSRS agent project (SMILE Orchestrate) can reuse. Each item has its own note covering what it is, its licence and maturity, a map onto our layers, integration steps and risks. Facts were checked on 2026-11-03. Stars and last-push dates come from the GitHub API, and second-hand claims are marked as such in each note.

Layers: **Sense** (read game or app state) · **Know** (knowledge base, memory) · **Decide** (planning, routing, reset policy) · **Show & Compete** (timer, race, leaderboards, explainers) · **Sangha** (SMILE Orchestrate: cooperating agents) · **Handover** (manual ↔ auto control).

## Ranked by value to us

| # | Item | Note | Licence | Value | Why it matters | Main layers |
|---|---|---|---|---|---|---|
| 1 | Claude / Gemini / GPT Plays Pokémon harnesses + PokéAgent | [plays-pokemon-harnesses.md](plays-pokemon-harnesses.md) | Gemini MIT, PokéAgent MIT, Claude starter none | 9 | The closest precedent for us: a knowledge base the agent edits itself, a navigator tool, sub-agents, saved turns you can replay, and a speedrun track that keeps the harness separate from the model. | Know, Decide, Sangha |
| 2 | LiveSplit + its built-in WebSocket server | [livesplit-autosplitters.md](livesplit-autosplitters.md) | MIT | 9 | The PWA can drive or mirror the real timer over `ws://localhost:16834/livesplit` while the game has focus. | Show & Compete, Handover |
| 3 | AutoSplit (image-matching autosplitter) | [livesplit-autosplitters.md](livesplit-autosplitters.md) | GPL-3.0 | 9 | Can autosplit Dragonwilds today from the "EXTRACTION POINT UNLOCKED" banner and cut-to-black templates we already match. | Sense |
| 4 | ManimCE (**integrated**) | [manim.md](manim.md) | MIT | 9 | Explainer videos rendered headless and reproducibly from our real data. Three scenes are rendered (see below). | Show & Compete |
| 5 | rs-sdk (Max Bittker) | [rs-sdk.md](rs-sdk.md) | MIT | 8 | A local, rules-safe RuneScape-like world with typed state, about 40 actions and MCP. A newer controller takes over from the old one, which maps onto our manual↔auto handover. | Sense, Decide, Sangha, Handover |
| 6 | Our adapters + benchmark harness spec (**written**) | [adapters.md](adapters.md) | ours | 8 | Maps the fields of rs-sdk, OSRS `present.md`/client_repl (port 7889) and the bridge's `/api/feed` onto each other, and scores sangha agents on one scale. | all |
| 7 | Mindcraft / MineCollab | [mindcraft.md](mindcraft.md) | MIT | 8 | Bots get a fixed command list, simple reactions run in code without the LLM, several agents chat in-game and humans can step in. Their main finding: messages between agents should be short and structured. | Sangha, Handover |
| 8 | Generative Agents | [generative-agents.md](generative-agents.md) | Apache-2.0 | 8 | Its memory design (event log, retrieval by recency, importance and relevance, periodic reflection) fits straight onto the bridge feed and the context it builds for Claude. | Know |
| 9 | speedrun.com API v1 | [splits-io-therun-gg.md](splits-io-therun-gg.md) | content CC BY-NC 4.0 | 8 | The official leaderboard, already used by HQ; browsers can call it directly, 100 requests/min. | Show & Compete |
| 10 | Observable Plot / anime.js | [motion-canvas-and-others.md](motion-canvas-and-others.md) | ISC / MIT | 8 | No build step: Monte-Carlo charts in the app, and timelines that follow the shared run clock. | Show & Compete |
| 11 | RuneBench ("RuneScape Bench") | [runescape-bench.md](runescape-bench.md) | unclear (README says MIT, no LICENSE file) | 7 | A tested set of tasks, verifiers and an XP-rate score, which we re-implemented in the harness spec. Don't copy its code until it has a LICENSE file. | Show & Compete, Sangha |
| 12 | Voyager | [voyager.md](voyager.md) | MIT | 7 | A library of skills checked to work, plus a curriculum, matching the OSRS hand routines and the "must be seen working" rule. | Know, Decide |
| 13 | CRADLE | [cradle.md](cradle.md) | MIT | 7 | Plays from screenshots plus keyboard and mouse, the only way to sense Dragonwilds. Too slow for real-time control, so use it to watch and coach. | Sense |
| 14 | therun.gg | [splits-io-therun-gg.md](splits-io-therun-gg.md) | MIT (plugin), no public API | 7 | Full attempt histories could calibrate the Monte-Carlo model; the undocumented live endpoint is best-effort. | Know, Show & Compete |
| 15 | livesplit-core | [livesplit-autosplitters.md](livesplit-autosplitters.md) | Apache-2.0/MIT | 7 | Reference implementations of comparisons (Balanced PB, goal) to port into our Timer. | Decide |
| 16 | Revideo / Vizzu | [motion-canvas-and-others.md](motion-canvas-and-others.md) | MIT / Apache-2.0 | 7 | TypeScript video renders that could read the JS model directly; animated chart transitions. | Show & Compete |
| 17 | OpenAI Five + AlphaStar | [openai-five-alphastar.md](openai-five-alphastar.md) | papers; pysc2 Apache-2.0 | 6 | Exploiter agents, a team-spirit reward and "surgery" to update models after patches; the mixed human/bot games are a handover precedent. | Sangha, Decide |
| 18 | Orak, lmgame-Bench, VideoGameBench, PokéChamp, … | [other-game-agent-benchmarks.md](other-game-agent-benchmarks.md) | mostly MIT | 6 | Keep the harness separate from the model; Orak's MCP interface; PokéChamp pairs LLM proposals with a simulator, like our LLM plus Monte Carlo. | Decide, Show & Compete |
| 19 | Motion Canvas / Manim Slides / asr (Unreal) | [motion-canvas-and-others.md](motion-canvas-and-others.md), [livesplit-autosplitters.md](livesplit-autosplitters.md) | MIT / MIT / Apache-2.0/MIT | 6 | Alternative explainer pipelines; a memory autosplitter is possible but breaks on every patch. | Show & Compete, Sense |
| 20 | BALROG | [balrog.md](balrog.md) | MIT | 5 | A 0–100 progress score and a "text first, image optional" observation format for raid evals. | Show & Compete |
| 21 | Recurse Center: "RuneScape Bench: MMOs for Agents" talk | [recurse-center-runescape.md](recurse-center-runescape.md) | n/a | 5 | Design criteria for benchmarks, and an early warning that cooperating agents may cheat. A talk, not code. | Sangha |
| 22 | ManimGL (3b1b) | [manim.md](manim.md) | MIT | 5 | Good for live authoring, but its code doesn't port to ManimCE; don't mix the two. | Show & Compete |
| 23 | MineDojo | [minedojo.md](minedojo.md) | MIT | 4 | The earlier example of a knowledge base built from YouTube, wiki and Reddit, which `scripts/ingest` already does. Reuse the ideas only. | Know |
| 24 | Route optimisers / ghosts / TAS | [route-optimisers-ghosts.md](route-optimisers-ghosts.md) | mixed | 2–4 | Our 6:48 target pace and split-aligned race already go further. The routing-as-graph paper is useful framing. | Decide |
| 25 | splits.io | [splits-io-therun-gg.md](splits-io-therun-gg.md) | AGPL-3.0 | 1 | Shut down and archived. Design reference only. | — |

## Integrated in this pass

**Explainer animations (ManimCE 0.22.1, venv on D:, no LaTeX).** Run `bash scripts/animations/render.sh`.
- `scripts/animations/export-data.mjs` builds `data/kb/prior/animation-data.json` from `js/data/raid.js` (RUNS, SPLITS, targetPace, communityBest) and the seeded Monte-Carlo model in `scripts/analysis/` (read in memory; nothing there is written).
- `race_to_650.py`: **Race to 6:50.** TexasPete 6:50.00, Nanobit 7:01.97 and the 6:48.1 target pace, each drawn as five split bars growing on one shared run clock, with live deltas to the target.
- `sum_of_best.py`: **Community sum of best.** The best segment for each split is lifted out of its run's bar (Vines, Fragments and Stronghold from TexasPete 6:50; Keep and Sanctum from Nanobit 7:01) and assembled into 6:38.27.
- `monte_carlo.py`: **How often does a run beat 6:50?** A histogram of 19k modelled finishes, labelled **MODELLED**. Filled bars: the TexasPete-calibrated profile on the route he actually ran for 6:50. Gold outline: the same runner on the model's current-patch default route. `scripts/analysis/model.mjs` is under active development, so re-render to refresh the numbers.
- Output: `media/animations/<name>.mp4` (1280×720, h264, 30 fps) plus `<name>.gif` (640 px, 12 fps).

**Benchmark harness and RuneScape adapters.** `adapters.md`, `data/kb/prior/benchmark-tasks.json` (10 starter tasks), `data/kb/prior/sources-rs.json` (28 sources). rs-sdk and RuneBench are cloned to `D:\claude-temp\prior\`. rs-sdk's pure unit tests pass 196/196 offline. RuneBench's leaderboard was recomputed from its published results; its harness needs Docker and API keys and was not run.

**Not vendored.** Nothing was copied into `vendor/`. rs-sdk (MIT) is a whole server plus SDK and is better used as an external sandbox than copied in. RuneBench has no LICENSE file, and AutoSplit is GPL-3.0.

## Next steps

1. **Autosplit Dragonwilds.** Make an AutoSplit profile from the banner and cut-to-black templates. Feed its splits to LiveSplit, and from LiveSplit's WebSocket server into the PWA and `/api/feed` (Sense → Show & Compete).
2. **Structured split events.** Add `{split, t}` fields to the app's split events (a small `js/` change) so the harness in `adapters.md` can score raid tasks without parsing text.
3. **rs-sdk sandbox for the sangha.** Run a local rs-sdk server and connect two or three agents through the adapter. Score cooperation and handover with the `benchmark-tasks.json` tasks before anything touches live OSRS, where agents stay read-only.
4. **Memory.** Add Generative-Agents-style retrieval (recency, importance, relevance) over the bridge feed. Every knowledge-base write should cite the feed event it came from, and deletions should be kept rather than lost.
5. **In-app explainers.** Port the Monte-Carlo histogram to Observable Plot inside the PWA. Keep ManimCE for shareable videos, and consider Manim Slides for a talk.
6. **RuneBench licence.** Ask Max Bittker to add a LICENSE file before reusing any RuneBench code.
