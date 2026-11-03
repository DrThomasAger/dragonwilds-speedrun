# rs-sdk (MaxBittker/rs-sdk)

Researched 2026-11-03. Clone read at commit `db0cc51e` (2026-10-29). Every fact below comes from the repo, its README, or the GitHub API. Facts that come from somewhere else are marked as such.

## What it is

rs-sdk is a TypeScript automation library for a RuneScape-style MMO, built for coding agents. The README calls it a "Research-oriented starter kit for runescape-style bots, including a typescript sdk, agent documentation and bindings, and a server emulator." Its stated goals are "a rich testing environment for goal-directed program synthesis techniques (Ralph loops, etc)" and "research into collaboration and competition between agents".

**It is not OSRS.** It is a fork of the LostCity engine and client, an emulator of **2004-era RuneScape 2** ("2004scape"). The README says bots made with it "will not work on the official game servers". The world-coordinate system (`worldX`/`worldZ`/`level`) is the same RuneScape tile grid that OSRS uses (`x`/`y`/`plane`). Much of the game content overlaps, but OSRS-only content does not exist there: Sailing, Grand Exchange-era items, later quests, and so on. rs-sdk has added a Grand Exchange of its own.

| | |
|---|---|
| Repo | https://github.com/MaxBittker/rs-sdk |
| Demo server / hiscores | https://rs-sdk-demo.fly.dev/hiscores (ranked by highest total level per lowest playtime) |
| License | MIT. The `LICENSE` file says "Copyright (c) 2025 Lost City", and GitHub reports `MIT`. Upstream LostCity is also MIT: https://github.com/LostCityRS/Server |
| Stars / forks / open issues | 1,096 / 162 / 57 (GitHub API, 2026-11-03) |
| Created / last push | 2026-01-22 / 2026-10-29 (`db0cc51e` "fix(engine): log out the client a takeover replaces") |
| Top contributors | Pazaz 1633 (LostCity upstream author), MaxBittker 487, Amb-rs 471, ultraviolet-jordan 421, Indio3 357 |
| HN launch | "RS-SDK: Drive RuneScape with Claude Code", 124 points, 42 comments, 2026-02-04: https://news.ycombinator.com/item?id=46888142 |
| Known forks | HazAT/rs-sdk (0 stars, last push 2026-02-07). samheutmaker/lumbridge-ai, "Lumbridge" by Sam Hogan, launched 2026-08-17 as a multi-agent RSPS (MIT, 21 stars). See https://runtimewire.com/article/sam-hogan-lumbridge-ai-agent-runescape-world |
| Maturity | Active and heavily used. It has a CI check (`bun run check`), an auto-generated API reference (`sdk/API.md`) that CI diffs against the code, 80+ SDK test and scenario files, and a public benchmark (RuneBench) built on top. |

### Architecture (from README)

```
LostCity engine (server/engine, NODE_TICKRATE default 400 ms, ::speed <ms> down to 20 ms)
   ⇅ game protocol
botclient (browser webclient)  or  headless "lite" client (server/webclient/src/lite)
   ⇅ WebSocket
gateway (server/gateway, ws://localhost:7780, AGENT_PORT)
   ⇅ WebSocket, routed by username
BotSDK  (sdk/: plumbing; state + raw sends)  ──  BotActions (porcelain: chopTree, openDoor, bank, trade, GE…)
   ⇅
MCP server (mcp/server.ts): tools execute_code, disconnect_bot, list_bots; resources "Bot API", "SDK API", GE guide
```

The server has been changed for bot work: faster XP curve, infinite run energy, no random events.

### What it exposes

- **State:** `BotWorldState` (`sdk/types.ts`), pushed by the client and read with `sdk.getState()` / `sdk.onStateUpdate(fn)`. It holds `tick`, `player` (name, hp/maxHp, worldX/worldZ/level, runEnergy, animId, combat, death and respawn counters), `skills[]` (level, baseLevel, experience), `inventory[]`, `equipment[]`, `nearbyNpcs[]` (id, index, name, x, z, options with opIndex), `nearbyPlayers[]`, `nearbyLocs[]`, `groundItems[]`, `gameMessages[]`, `dialog`, `interface`, `shop`, `bank`, `trade`, `ge`, `prayers`, `combatEvents[]`, and `opFeedback` (counts of probable server rejections).
- **Actions:** a closed `BotAction` union of about 40 primitives, each with a required `reason` string: `walkTo`, `interactNpc`, `interactLoc`, `useItemOnLoc`, `clickDialogOption`, `bankWithdraw`, `say`, `spellOnNpc`, `togglePrayer`, and so on. High-level `bot.*` methods "attempt to observe method-specific evidence". Low-level `sdk.send*` only confirms that the client dispatched the action, not that the server applied it. `ActionResult` carries `success`, `message`, `reason` (`cant_reach`, `no_match`, `timeout`…) and `phase` (`validation|routing|dispatch|observation|completion`).
- **Connection modes:** `control` sends actions. `observe` is read-only plus `say`, and never pre-empts the controller. A new controller takes over from the old one ("takeover"). This is exactly the handover primitive we need.
- **LLM harness:** an MCP stdio server whose `execute_code` runs TypeScript with `bot` and `sdk` globals. `CLAUDE.md`, `AGENTS.md` and `GEMINI.md` give agent instructions. `learnings/*.md` holds per-skill playbooks that work as a knowledge base. A text formatter (`sdk/formatter.ts`) turns state into a compact summary for prompts.

## What we ran (offline only, no demo server, no accounts)

Cloned to `D:\claude-temp\prior\rs-sdk`. Bun 1.2.21 was unpacked from the npm package `@oven/bun-windows-x64` into `D:\claude-temp\prior\tools`. All caches were pointed at `D:\claude-temp\prior\cache`.

1. `bun install --frozen-lockfile --ignore-scripts` → 225 packages. Puppeteer's browser download was skipped. `server/gateway`: 4 packages.
2. `bun test sdk/test`, all 31 test files, first pass without `bun` on PATH: **213 pass / 30 fail / 1 error**. Every failure came from tests that spawn a `bun` child or a local gateway (`Executable not found in $PATH: "bun"`), or from POSIX-shell tests.
3. Second pass with `bun` on PATH: gateway tests mostly recovered. The remaining failures were `connect-handshake` (2 s handshake timeouts against a fake gateway on Windows), `gateway-supervisor` (expects a `set -e` bash supervisor), `api-docs` (the generated doc differs on Windows line endings), and a `direct-gateway` timeout. The run hit my 550 s cap before it printed a summary.
4. The pure unit subset (22 files; gateway, runner, MCP-market and api-docs tests excluded) gave **196 pass / 0 fail, 597 expect() calls, 26 s**.
5. `D:\claude-temp\prior\scripts\format_demo.ts` fed a synthetic `BotWorldState` through `formatWorldStateSummary` and printed:
   ```
   Pos (3222, 3218)
   Inv 1/28: Bronze axe
   NPCs: Chicken (3t)
   Objs: Tree (2t)
   ```
   This confirms how compact the state is when written as a prompt (compare with our `present.md`, which runs to hundreds of lines).

We did not start the engine, connect to `rs-sdk-demo.fly.dev`, or create any bot account. Running the engine locally is possible (`server/engine && bun run start`) and stays offline. It is the next step if we want live sandbox episodes.

## Mapping onto our layers

| Layer | rs-sdk piece | Use for us |
|---|---|---|
| **Sense** | `BotWorldState` via `onStateUpdate`. `observe` connections. `formatWorldStateSummary`. | A clean, typed observation. We map it to the same common frame as `present.md` (see `adapters.md`). |
| **Know** | `learnings/*.md` (banking, combat, fishing, walking…), `sdk/API.md`, `sdk/MARKET.md`, collision data plus pathfinding | Seed for our knowledge base. RuneBench also gives agents a folder of wiki markdown. Our `data/kb` plays the same role for Dragonwilds. |
| **Decide** | Agents write TS against `bot`/`sdk` through MCP `execute_code` (program synthesis), not per-tick action selection | Our Claude panel already runs Claude Code headless. The same "write a script, run it in the background, check the rate" loop applies. |
| **Show & Compete** | Demo-server hiscores (total level per playtime), RuneBench leaderboard | A sandbox where sangha agents can be ranked without any ToS risk |
| **SMILE Orchestrate sangha** | Multiple bots per gateway (routed by username), `say`/`privateMessage`, trade API, GE. Goals explicitly include "collaboration and competition between agents". | Run a gatherer/processor/trader sangha. Score cooperation (see Benchmark harness spec in `adapters.md`). |
| **Handover manual↔auto** | `control` vs `observe` modes and controller takeover | A human (browser client) and an agent (SDK) on the same character, with an explicit controller token. This is the cleanest handover testbed we have found. |
| **Knowledge base** | `learnings/`, API docs, chat history, trajectories | Ingest into `data/kb/prior/`, tagged by skill |

## Concrete integration steps

1. **Sandbox, local only.** Run `server/engine`, `server/webclient`, and `server/gateway` on 127.0.0.1 with `NODE_TICKRATE=100`, all under `D:\claude-temp\prior\rs-sdk`. Never point it at the demo server for benchmark runs, because the demo has no uptime or persistence guarantee and the README asks people not to play manually there.
2. **Bridge adapter.** Write a small `bun` process that opens an `observe` connection, converts each `BotWorldState` into a common frame (`adapters.md` §2), and POSTs it to `http://127.0.0.1:5180/api/feed` as `{source:"rs-sdk", type:"snapshot"|…}`. The Claude panel then sees sandbox play exactly as it sees Dragonwilds splits.
3. **Action adapter.** Use the common action schema → `BotAction` (via `bot.*` porcelain where it exists), with the `reason` field filled from the agent's stated intent. That field becomes the instruction-adherence evidence.
4. **Handover.** Model the human in the browser client and the agent as an SDK `control` connection. Log every takeover as a `handover` event and score it (`adapters.md` §5.5).
5. **Benchmarks.** Use RuneBench's verifier logic (peak XP/min, peak gold) as two of our task families (`data/kb/prior/benchmark-tasks.json`).
6. **KB.** Copy the `learnings/*.md` titles and URLs into the KB index. Link rather than vendor, because the content is MIT but changes often.

## Risks

- **Wrong game.** This is 2004scape, not OSRS or Dragonwilds. Skills transfer in concept (APIs, harness, scoring), not in content. Coordinates line up with OSRS, but object IDs and NPC IDs do not.
- **Not for live servers.** Automating official OSRS breaks Jagex's rules. rs-sdk itself says it won't work there. Our OSRS project's `client_repl`/`option_mirror` are for reading. Any rs-sdk-style action layer must stay in the emulator.
- **Prompt injection through chat.** The README warns that seeing other players' chat "exposes the bot to scamming and prompt-injection attempts" (`SHOW_CHAT=false`). In a multi-agent sangha, agent-to-agent chat is untrusted input.
- **Windows friction.** Some tests and scripts assume POSIX shells. Bun's npm postinstall failed on this machine, so we used the platform package directly.
- **Fast-moving API.** It is actively developed (last push 2026-10-29, and state fields are versioned with "absent on older clients" notes). Pin a commit (`db0cc51e`) in any adapter.
- **Modified game rules.** Faster XP, infinite run energy and no random events mean rates are not comparable to the real game.
