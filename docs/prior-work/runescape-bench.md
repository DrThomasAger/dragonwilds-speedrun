# RuneBench / runescape-bench ("RuneScape Bench")

Researched 2026-11-03. Clone read at commit `99afc8f5` (2026-10-30).

## What it is

RuneBench is a benchmark of AI coding agents playing RuneScape tasks through rs-sdk. From the README: "Agents play the game by writing and executing TypeScript snippets against an emulated game server running at 8x speed. Each agent also gets a folder of markdown files extracted from the game wiki for strategy reference. Agents are scored on their peak XP rate — the best XP/min measured in any 15-second window." It runs on the **Harbor** agent-benchmark framework (https://harborframework.com/).

It is the only RuneScape LLM-agent benchmark I found. "RuneScape-Bench", "runescape-bench" and "RuneBench" are all names for this one project. The README's H1 is `runescape-bench` and the site title is RuneBench. **I found no OSRS-specific LLM benchmark.**

| | |
|---|---|
| Repo | https://github.com/MaxBittker/runebench. rs-sdk's README still links the old name, https://github.com/MaxBittker/rs-bench. |
| Results site | https://maxbittker.github.io/runebench/ |
| Harbor dataset | `maxbittker/runebench`, **32 tasks** in `dataset.toml` (16 skills × 15m/30m). https://hub.harborframework.com/datasets/maxbittker/runebench |
| License | **Unclear.** The README ends with "## License MIT", but the repo has **no LICENSE file**, and the GitHub API reports `license: null`. Treat it as MIT-intended and ask the author before vendoring code. Linking and re-implementing the scoring is safe. |
| Stars / forks / issues | 172 / 14 / 8 (2026-11-03) |
| Created / last commit | 2026-02-26 / 2026-10-30 (`99afc8f5`, "Replace Mistral Large 4 preview rows with open-weight release…") |
| Contributors | MaxBittker (139 commits, sole listed contributor). `task.toml` metadata names "Sean Lee" as task author. |
| Maturity | Active. 103 model result files for the 30-minute skills suite, about 40 model adapters (`agents/*_adapter.py`), cost post-processing, trajectory extractors and n-gram analyses. It has a third-party mirror: BenchLM (https://benchlm.ai/benchmarks/runescapebench) describes the aggregate as average ln(1 + XP/min) and calls it "display only", because it measures scaffolds as much as models. |

## Tasks (from `generate-tasks.ts`)

- **Skill XP:** 16 skills (Attack, Defence, Strength, Hitpoints, Ranged, Prayer, Magic, Woodcutting, Fishing, Mining, Cooking, Fletching, Crafting, Smithing, Firemaking, Thieving) × {15 min, 30 min}. There is also a 5-minute woodcutting smoke task.
- **Gold:** 4 starting conditions (`vanilla`; `smith-alch`, with 99 Mining/Smithing/Magic in Falador; `fish`, with 50 Fishing at Catherby; `fletch-alch`, with 50 Fletching/Magic in Seers) × {15m, 30m} = 8 tasks. Coins in inventory and bank both count. BenchLM says "3 gold accumulation tasks", but the current code has 8.
- **Instruction** (`instruction.md`): a fixed prompt. It says start with `await bot.skipTutorial()`, get a non-zero baseline, then iterate, and run long loops as background `bun` scripts. Rules: no server, save-file or cheat edits. The agent runs as an unprivileged user, and the tracker output is root-owned.
- **Environment:** a Docker image with engine, gateway and MCP at 8× speed. 2 CPUs, 8 GB RAM cap, 10 GB disk, internet allowed. MCP server `rs-agent` (stdio, `bun run /app/mcp/server.ts`). Agent timeout is the duration + 120 s.

## Metrics and scoring (verified in code)

- **Skill tasks** (`shared/check_skill_xp.ts`): a root-owned tracker samples XP every 15 s. For each sample *i*, the window starts at the nearest earlier sample at least 12 s back (`MIN_PEAK_WINDOW_MS = 12000`).
  `rate_i = ΔXP / Δms × 60000 / 8 / 25`. The ÷8 undoes the game speed and the ÷25 undoes the server XP multiplier, giving real-game XP/min.
  `reward = round(max_i rate_i)`, written to `/logs/verifier/reward.txt` and to `reward.json` (`{skill, peakXpRate, xp, level, tracking}`).
- **Gold tasks** (`shared/check_gold.ts`): 5 s sampling. `reward = max(peak sampled gold, final gold)`.
- **Aggregate** (`views/*.js`, `app/components/*.js`): `score = (1/16) Σ_skills ln(1 + peakXpRate)`. Cost is shown against score as a Pareto view.
- The verifier connects with `connectionMode: 'observe'`, so scoring never takes control of the bot.

### What we ran

`D:\claude-temp\prior\scripts\score_runebench.py` (our own script, run with `python -I`) recomputed the aggregate from the published `results/skills-30m/*.json` files (103 files). Top 10 by mean ln(1+peak XP/min):

```
7.258 gpt6astra-high   6.910 gpt6astra   6.907 gemini4argon   6.876 gpt61sol-high   6.787 gpt61sol
6.746 gpt61sol-low     6.662 opus55-xhigh 6.649 gpt61terra   6.632 opus55         6.444 gpt6sol-high
(fable-5 6.007, fable-5-xhigh 5.678)
```

This matches BenchLM's "7.3" for the leader. BenchLM's page, as quoted in search results, shows the mean-log score with a "%" sign. It is not a percentage. `results/skills-15m` and `results/skills-10m` only hold `_data.js` bundles in this checkout, so I did not score them. Each per-skill record has `peakXpRate, finalXp, finalLevel, durationSeconds, sampleCount, samples, tokenUsage, trajectory, toolCalls, firstStepAt`. That is a ready-made episode format.

We did **not** run `harbor run`. It needs Docker, the pre-built image, and model API keys. Every step of the scoring maths is reproducible offline from the results JSON.

## Mapping onto our layers

| Layer | RuneBench piece | Use |
|---|---|---|
| Sense | Root-owned `skill_tracker.ts` samples, trajectory extractors | Tamper-proof sampling: the scorer's data lives where the agent can't write. Our bridge feed should keep its scored events append-only. |
| Know | Wiki markdown folder per task | The same pattern as our `data/kb`. Measure with and without the KB, as an ablation. |
| Decide | Agent scaffold is free (Claude Code, Codex, OpenCode…) | We plug in sangha agents as one "agent" |
| Show & Compete | Peak-window metric, log aggregate, cost Pareto, public site | Use for OSRS-style tasks. For Dragonwilds, the matching metric is split time against the 6:48.1 target. |
| Sangha | Listed as future work (gatherer + processor) | We add cooperation metrics (`adapters.md` §5.4) |
| Handover | None (fully autonomous) | We add handover scoring (`adapters.md` §5.5) |
| Knowledge base | `results/*.json` trajectories, `scripts/ngram-*.py` | Mine failure patterns as KB entries |

## Concrete integration steps

1. Adopt RuneBench's task shape (instruction + environment + verifier + reward.json) as our task schema. This is done in `adapters.md` §5 and `data/kb/prior/benchmark-tasks.json`, with `family: "runebench-compatible"` for the copied tasks.
2. Re-implement the peak-window verifier as a pure function over our episode JSONL. The Python sketch is in `adapters.md` §5.3. Do not import their TS, because of the license gap.
3. For sandbox runs, use the rs-sdk local engine and keep the ÷8/÷25 normalization when the tick rate and XP multiplier match theirs. Otherwise record `speed_factor` and `xp_multiplier` in the task.
4. Ask MaxBittker to add a LICENSE file before copying any of: `generate-tasks.ts`, `shared/*.ts`, `views/*`.
5. Report sangha results in the same aggregate, so one number is comparable with theirs (single-agent baseline vs sangha).

## Risks

- **License gap** (no LICENSE file).
- **Scaffold-confounded.** BenchLM notes it measures scaffolds as much as models. Our sangha numbers are scaffold numbers.
- **Noise.** The results site notes long runtimes, environment noise and low sample sizes ("false negatives").
- **Not OSRS and not Dragonwilds.** Rates reflect a modified 2004scape server.
- **Cost.** 16 tasks × 30 min per model run, on 8 GB containers.
