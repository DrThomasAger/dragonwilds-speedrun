# BALROG

Benchmark for LLM and VLM agents on long-horizon games: BabyAI, Crafter, TextWorld, Baba Is AI, MiniHack, NetHack. Each task is scored 0-100 (progress, not only win/loss). It runs text-only or text+image observations, and its main finding is that many models do worse when given images. NetHack is far from solved.

- Repo: https://github.com/balrog-ai/BALROG
- Paper: https://arxiv.org/abs/2411.13543 (ICLR 2025, https://iclr.cc/virtual/2025/poster/28856)
- Leaderboard: https://balrogai.com
- License: MIT
- Maturity: 276 stars, last push 2026-04-09. Peer reviewed, still maintained.

## Mapping onto our layers

| Layer | BALROG | Take for us |
|---|---|---|
| Sense | Each env has a wrapper that turns state into a text description, plus an optional image | Our "text first, image optional" rule: the bridge snapshot (`snapshot-form`) is text. Use `look.mjs` screenshots only when the text is missing something. |
| Know | None (in-context history only) | Gap. Our KB (`data/kb`) is ahead of it. |
| Decide | Agent templates: naive, chain-of-thought, few-shot, custom | Copy the pluggable "agent strategy" interface so Decide strategies can be swapped and A/B tested. |
| Show & Compete | 0-100 progress score per env, public leaderboard | Copy the progress metric: score a raid as the fraction of splits reached, plus time. A DNF still gets credit. |
| Sangha | None | - |
| Handover | None | - |
| Knowledge base | None | - |

## Integration steps
1. Define a `dw-progress` score in `scripts/analysis/lib.mjs`: `100 * splits_reached / N_SPLITS`, with a time bonus when the run finishes. Log it on every `/api/feed` `split`/`reset` event.
2. Write a BALROG-style env wrapper for the OSRS side: a babashka function that turns `/api/feed` `{events, snapshot}` into a fixed text observation (the last N events plus the snapshot EDN). Use the same function for every agent so strategies are compared fairly.
3. Optional: run BALROG's NetHack/Crafter evals on whichever model we use, as a baseline for long-horizon play before we spend real-game time.

## Risks
- These are grid and roguelike games, not 3D real-time ones, so the scores will not predict Dragonwilds performance.
- Python harness. Only the ideas carry over, not the code.
