# "Plays Pokémon" harnesses (Claude / Gemini / GPT) + PokéAgent Challenge

These are livestreamed frontier-model runs of Game Boy Pokémon. They are the closest public precedent for a long-running LLM agent with tools, memory and a human operator who tweaks the harness live.

| Harness | Links | License | Maturity |
|---|---|---|---|
| Claude Plays Pokémon (Anthropic, David Hershey) | Starter: https://github.com/davidhershey/ClaudePlaysPokemonStarter. Design interview: https://www.latent.space/p/how-claude-plays-pokemon-was-made. Stream: twitch.tv/claudeplayspokemon | No LICENSE file (treat as all rights reserved) | 206 stars, last push 2025-04-03. The starter is minimal; the full harness is not public. |
| Gemini Plays Pokémon (Joel Z, independent) | https://github.com/waylaidwanderer/gemini-plays-pokemon-public (run state, notepads, custom tools/agents). Coverage: https://techcrunch.com/2025/05/03/googles-gemini-has-beaten-pokemon-blue-with-a-little-help | MIT | 38 stars, pushed 2026-11-03 (live). Gemini 2.5 Pro beat Blue in May 2025. |
| GPT Plays Pokémon (Clad3815) | https://github.com/Clad3815/gpt-play-pokemon-firered | NOASSERTION | 86 stars, last push 2026-02-15. GPT-5 finished Red in about 6.5k steps and Crystal in about 9.5k (reported by the streamer, not official). |
| Community scaffold | https://github.com/cicero225/llm_pokemon_scaffold (fork of the Claude starter, with an ASCII-map navigator) | see repo | - |
| PokéAgent Challenge (NeurIPS 2025 competition) | https://arxiv.org/abs/2603.15563, https://pokeagentchallenge.com, harness: https://github.com/sethkarten/continual-harness | MIT | 343 stars, last push 2026-05-13. 100+ teams. Has an **RPG speedrun track** (Emerald). |

## Design patterns
- **Claude:** three tools: buttons, an **editable knowledge base** in the prompt (the agent adds, edits and deletes sections), and a **navigator** (point at an on-screen tile and the harness pathfinds). When context fills up, it is summarised into the KB. Known failures: the agent deletes useful notes, and it writes wrong facts into the KB and trusts them for a long time.
- **Gemini:** RAM-derived text state (map tiles, position) plus frames, a notepad, and map markers. The model can **write its own tools** (Python, sandboxed) and **spawn custom sub-agents**, such as a pathfinder or puzzle solver. Every turn is committed as a save state + git commit, so a run can be replayed and rewound. The operator changes the harness mid-run, which is why he says it is "not a benchmark".
- **GPT:** a stronger harness with RAM state, minimap, and goal tracking. Results are given as step counts, the cleanest speed metric.
- **PokéAgent:** explicitly separates *harness* from *model* ("earlier efforts conflated harness with model capability"), and has a standard speedrun evaluation with multi-agent orchestration.

## Mapping onto our layers

| Layer | Pokémon harnesses | Take for us |
|---|---|---|
| Sense | RAM -> text map plus screenshot | OSRS: RuneLite REPL is our RAM read (`snapshot-form`). Extend it with nearby NPCs/objects and collision tiles as an ASCII grid. |
| Know | Editable KB plus summarisation | `data/kb` plus agent memory. Add the provenance and checks Claude lacked. |
| Decide | Navigator tool, self-written tools, sub-agents | OSRS: `quests/planner.py` A* is our navigator. Expose it as one tool `walk-to(tile)`. Let the agent write Clojure helpers into `skills/`. |
| Show & Compete | Step count, badges, Twitch overlay | Steps / time-to-milestone. The PWA is our overlay. PokéAgent speedrun track is a direct analogue of our lab. |
| Sangha | Gemini custom sub-agents | Sangha is the same pattern: spawned specialists sharing one notepad (the feed). |
| Handover | Operator edits harness and notes live | Make it explicit and logged: every human intervention is a feed event `{type:"handover", from:"human"}` so results stay honest. |
| Knowledge base | Notepad.md / KB sections | Store notes as files under `data/kb/agents/`, and git-commit each turn like Gemini does. |

## Integration steps
1. Add tools in the bridge: `kb.read`, `kb.write(section, text, source_event_id)`, `kb.delete(section, reason)`. Deletes go to a tombstone file, never really deleted (this fixes Claude's "deleted something useful").
2. Navigator: `/api/eval` preset `walk-to` that calls the OSRS A* planner and returns path length/ETA. The LLM chooses targets, not clicks.
3. Snapshot commits: after every agent turn, append `{turn, snapshot, action}` to `live/turns.jsonl`. This lets us replay later and supports "rewind to turn N" in OSRS by re-planning from that state.
4. Score like PokéAgent: log harness version + model ID with every result, so harness gains and model gains are kept apart.
5. Dragonwilds: the "navigator" for the human is the Run navigator page. The agent's role is coaching (which skip to drill next, reset or continue, from `simulate.mjs` reset thresholds).

## Risks
- Harness drift makes results impossible to compare. Version the harness.
- KB poisoning (wrong facts kept forever). Require a source event for every KB write and add a periodic "audit KB vs. feed" job.
- The Claude starter has no licence. Do not copy its code; re-implement the patterns.
