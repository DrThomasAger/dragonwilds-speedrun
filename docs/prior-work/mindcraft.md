# Mindcraft / MineCollab

LLM agents that play Minecraft as in-game bots (Node.js + Mineflayer). Each bot gets about 47 parameterised commands (`!goToPlayer`, `!collectBlocks`, `!craftRecipe`, ...) and can also write and run its own Mineflayer JS. MineCollab is the multi-agent benchmark built on it: cooking, crafting and construction tasks that need cooperation. Main finding: communication is the bottleneck. Performance drops by up to about 15% when agents have to share detailed plans.

- Repo: https://github.com/mindcraft-bots/mindcraft (moved from kolbytn/mindcraft)
- Paper: "Collaborating Action by Action: A Multi-agent LLM Framework for Embodied Reasoning", https://arxiv.org/abs/2504.17950. A NeurIPS 2025 entry, "Blocks, Bots, and Bottlenecks" (https://neurips.cc/virtual/2025/137194), uses the same names. I have not confirmed that it is the same work.
- Site: https://mindcraft-minecollab.github.io
- License: MIT
- Maturity: about 6.0k stars, last push 2026-10-27. Very active. Large community of profiles and model backends.

## Mapping onto our layers

| Layer | Mindcraft | Take for us |
|---|---|---|
| Sense | Mineflayer world state as text (`!stats`, `!inventory`, `!nearbyBlocks`) | Same pattern as our `snapshot-form`. Add `!`-style query commands to the bridge (`/api/eval` presets). |
| Know | Per-bot memory summary, saved "places", example-based few-shot from past convos | Persist bot memory to `data/kb/agents/memory.json` (already exists). |
| Decide | LLM picks `!commands`. Long actions are interruptible "modes" (self-defence, unstuck, item pickup) that run without the LLM | **Most valuable idea:** reflex "modes" in code, outside the LLM loop. For OSRS: eat/pray/flee as REPL-side reflexes. For Dragonwilds: auto-split/reset detection. |
| Show & Compete | MineCollab task suite with success rate | Template for a task suite (per-skip success rate is our Practice page). |
| Sangha | Many bots on one server talking through in-game chat; `!startConversation` | Direct model for our sangha: agents exchange messages through `/api/feed` events with `source: agent-name`. |
| Handover | Humans chat commands to bots in-game; bots pause and resume | Human types in the ✦ panel and the agent yields. Copy their "stop/resume self-prompt" (`!stop`, self-prompting goal loop). |
| Knowledge base | None beyond memory | - |

## Integration steps
1. Define a `!command`-style tool table for OSRS in the bridge: a map of name -> Clojure form sent through `game-eval`. Expose `GET /api/tools` so Claude Code sees one list.
2. Add `modes`: a babashka `every` loop (we already have `every`) that checks the snapshot for HP < X, stuck tile, or idle, and fires reflex code without the LLM. It posts a `mode` event to the feed.
3. Sangha: tag each agent's events with `source` and `to`, and have the panel render them as a chat thread. Copy MineCollab's finding: keep inter-agent messages short and structured (EDN), not prose plans.
4. Self-prompt loop: a goal string stored in `@claude`. When a run finishes and `!busy`, re-issue the goal unless a human posted in the last N seconds (the handover rule).

## Risks
- Minecraft has a scriptable server-side bot API (Mineflayer). Dragonwilds has none, so on Dragonwilds we only observe (timer/app events, video). The agent-acts parts apply to OSRS via RuneLite only, and Jagex rules on automation apply there (an account ban risk on live servers).
- Running untrusted code: Mindcraft has an "allow_insecure_coding" flag for good reason. Our `/api/eval` is the same kind of risk. Keep it bound to 127.0.0.1 (it already is).
