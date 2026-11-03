# Other game-agent benchmarks and harnesses (brief)

| Item | Links | License | Maturity | Why it matters to us |
|---|---|---|---|---|
| **VideoGameBench** | https://github.com/alexzhang13/videogamebench, https://arxiv.org/abs/2505.18134 | NOASSERTION (check repo) | 377 stars, last push 2025-05-30. arXiv only. | 23 Game Boy/DOS games, vision only. The best model (Gemini 2.5 Pro) completed 0.48%. Shows that raw-pixel real-time play is weak, so Dragonwilds should stay sense/coach only. |
| **Orak** (Krafton) | https://github.com/krafton-ai/Orak, https://arxiv.org/abs/2506.03610 | MIT | 172 stars, last push 2025-06-17. ICLR 2026. | 12 real commercial games behind an **MCP** plug-and-play interface, plus a fine-tuning dataset of trajectories. MCP is the right shape for exposing our bridge tools to any LLM. |
| **lmgame-Bench / GamingAgent** | https://github.com/lmgame-org/GamingAgent, https://arxiv.org/abs/2505.15146 | MIT | about 1.0k stars, last push 2025-11-16. arXiv. | Gym-style API with optional perception and memory "scaffolds" to separate model skill from harness. Same harness-vs-model separation that we need. |
| **GameArena** | https://arxiv.org/abs/2412.06394 (ICLR 2025) | - | Paper. Live human-vs-LLM games. | Measuring reasoning through live play with humans (85% of sessions useful vs. under 5% in Chatbot Arena). Model for a "play against the coach" mode. |
| **PokéChamp** | https://github.com/sethkarten/pokechamp, https://arxiv.org/abs/2503.04094 (ICML 2025) | NOASSERTION | 188 stars, last push 2026-03-11 | LLM inside **minimax search** (action sampling, opponent model, value estimate). Pattern: LLM proposes, search/simulator scores. That is our LLM + Monte-Carlo pairing. |
| **PokéAgent Challenge** | https://arxiv.org/abs/2603.15563, https://github.com/sethkarten/continual-harness | MIT | 343 stars. NeurIPS 2025 competition. | Has an RPG **speedrun** track with a standard harness. The closest benchmark to our goal. See `plays-pokemon-harnesses.md`. |
| **TextArena** | https://github.com/TextArena/TextArena, https://arxiv.org/abs/2504.11442 | MIT | 436 stars, last push 2026-10-05 | 50+ text games with an online Elo ladder against humans and models. Ready-made way to rank sangha agents against each other. |
| **PufferLib** | https://github.com/PufferAI/PufferLib | MIT | about 6.6k stars, last push 2026-10-14 | Fast RL environments (includes Pokémon Red). Only relevant if we ever train RL policies for OSRS sub-skills. |
| **PySC2** | https://github.com/google-deepmind/pysc2 | Apache-2.0 | about 8.3k stars, last push 2024-07 | AlphaStar's environment. Reference only. |

## Shared lesson
Every serious 2025-26 benchmark (lmgame-Bench, Orak, PokéAgent) separates **harness** from **model**. For SMILE Orchestrate:
1. Version the bridge and toolset (`/api/status` returns `harness: <git sha>`).
2. Expose tools over MCP (Orak style) so Claude Code, Gemini or GPT can be dropped in and compared under the same Sense/Know tools.
3. Report time-to-milestone (speedrun) alongside a 0-100 progress score (BALROG).

## Integration steps
1. Wrap the bridge endpoints (`/api/feed`, `/api/eval`, KB read/write, `walk-to`) as an MCP server (babashka can serve MCP over stdio/HTTP). Claude Code then uses them natively instead of curl.
2. Read PokéAgent's speedrun eval protocol before designing OSRS quest-speed evals.

## Risks
- Most of these are research code that stops being maintained after the paper. Depend on the ideas, not the packages.
- The licence of VideoGameBench and PokéChamp is unclear (NOASSERTION). Check before reusing any code.
