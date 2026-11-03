# Adapters: rs-sdk / RuneBench ⇄ OSRS mirror ⇄ Raid Lab bridge

This doc covers how outside observation and action schemas (rs-sdk `BotWorldState` / `BotAction`, RuneBench reward files) map onto:

1. the OSRS project (`D:\labyrinth\Github\SmilePrompt\Composer\osrs`): `option_mirror` (`live\present.md`, `live\requests.md`) and `client_repl` (nREPL on 127.0.0.1:7889),
2. our bridge (`scripts/bridge.clj`): `GET /api/feed` → `{events:[…last 100], snapshot}` and `POST /api/feed` (merged with `{source:"app"}`, stamped `at`, appended to `live/feed.jsonl`, broadcast over SSE).

It ends with the **Benchmark harness spec** (§5) for scoring sangha agents.

All of this is a design. Nothing here has been wired into `scripts/` or `js/`, which this research pass was not allowed to touch.

---

## 1. The sources as they actually are

### 1a. rs-sdk (`sdk/types.ts`, commit db0cc51e)
`BotWorldState { tick, inGame, player{name,hp,maxHp,worldX,worldZ,level,runEnergy,animId,combat{inCombat,targetIndex,targetType},isDead,…}, skills[{name,level,baseLevel,experience}], inventory[{slot,id,name,count,optionsWithIndex[{text,opIndex}]}], equipment[…], nearbyNpcs[{id,index,name,combatLevel,x,z,distance,options,optionsWithIndex}], nearbyPlayers[…], nearbyLocs[{id,name,x,z,level,distance,options,optionsWithIndex}], groundItems[{id,name,count,x,z,distance}], gameMessages[], dialog, interface, shop, bank, trade?, ge?, prayers, combatEvents[], opFeedback? }`.
Actions: `BotAction` union (`walkTo`, `interactNpc{npcIndex,optionIndex}`, `interactLoc{x,z,locId,optionIndex}`, `useInventoryItem{slot,optionIndex}`, `pickupItem`, `clickDialogOption`, `bankWithdraw`, `say`, …), each with a `reason`. Connections are `control` or `observe`.

### 1b. OSRS `present.md` (Option Mirror plugin)
`# Option mirror at YYYY-MM-DD HH:MM:SS.mmm`, then the sections `## Player` (name, world, `tile: x, y, plane p`, animation, interacting with, run energy, run, open interfaces, `hitpoints: a/b`, `prayer: a/b`, combat level, special attack, skull, targeted by, attackable, auto-retaliate, `levels: Attack 1, …`, `game tick: N`, canvas, mouse), `## Screen`, `## Menu under mouse`, `## Open menu`, `## Dialogue`, `## Chat` (`- [ts] type: text`), `## Inventory` (`- slot i: n x Name at canvas x,y size wxh` + `actions: …`), `## Equipment worn` (`- head: 1 x White cavalier`), `## NPCs on screen` (`- Name id N index I tile x,y at canvas … hull … minimap …` + actions), `## Players on screen`, `## Objects on screen` (`- Tree (object id 1276) tile x,y …` + actions), `## Ground items on screen`, `## Interface options` (`- widget 548.24[1] …` + actions), `## Walk targets`.
The Clojure parser already exists: `clj/src/osrs/mirror.clj` → `(frame)` returns `{:at :player :screen :inventory :equipment :npcs :objects :ground :menu :widgets :chat :dialogue}`.
Actions are `live\requests.md`, written in the mirror's own format: section heading + entry line + `action: <Option>`, plus a `## Key` section for key presses. `perform.py` performs them. Note that `present.md` has **levels only, no XP**. `osrs.game/skills` over port 7889 supplies the XP.

### 1c. OSRS `client_repl` (nREPL :7889)
Bencode `{"op":"eval","code":…}`. Code must run on the client thread: `(g/on-client #(…))` with `osrs.client/client`. The bridge's `snapshot-form` returns an EDN string `{:player :world :tile :hp [boosted real] :prayer :run-energy :levels {"ATTACK" n …} :total}`.

### 1d. Bridge feed (`scripts/bridge.clj` + `js/lib/bridge.js`)
Event: `{at: ms, source: "app"|"osrs"|"log", view?, type, text, …extra}`. The app currently emits `run-start`, `split` (text only, e.g. `"Dragontail Vines 1:21.52"`), `finish` (`{splits:[s…], golds}`), `reset` (`"Reset in <split name>"`), `segment`, `practice`. OSRS emits `connected`/`disconnected`, and the log tail emits `line`. `GET /api/feed` also returns `snapshot` (the latest OSRS EDN string).

---

## 2. Common frame (Sense)

We normalise every source to one JSON frame. The episode log in §5 stores these.

```json
{ "kind": "obs", "src": "osrs-mirror|osrs-repl|rs-sdk|dw-app",
  "t": 12345, "wall": 1762150000000, "tick": 9412,
  "player": { "name": "35xc", "tile": [2499, 3509, 0], "hp": [49, 49], "prayer": [1, 1],
              "run": { "energy": 100, "on": true }, "anim": 9350, "interacting": "Fishing spot" },
  "skills": { "Fishing": { "level": 65, "xp": null } },
  "inventory": [ { "slot": 0, "name": "Coins", "count": 11017852, "actions": ["Use","Drop","Examine"] } ],
  "equipment": { "head": "White cavalier" },
  "npcs":    [ { "name": "Fishing spot", "id": 1542, "index": 14753, "tile": [2500, 3512, 0], "actions": ["Use-rod"] } ],
  "objects": [ { "name": "Tree", "id": 1276, "tile": [2497, 3511, 0], "actions": ["Chop down"] } ],
  "ground":  [ { "name": "Leaping salmon", "count": 1, "tile": [2499, 3507, 0], "actions": ["Take","Examine"] } ],
  "dialogue": [], "chat": [ { "ts": "…", "type": "spam", "text": "You catch a leaping trout." } ],
  "control": { "holder": "human|agent:<id>|none", "since": 1762150000000 } }
```

### 2.1 Field-level mapping (observation)

| Common field | rs-sdk `BotWorldState` | OSRS `present.md` (via `osrs.mirror/frame`) | OSRS client_repl snapshot | Bridge feed |
|---|---|---|---|---|
| `tick` | `tick` | Player `game tick: N` → `:player :tick` | not in snapshot. Add `(.getTickCount c)` | – |
| `player.name` | `player.name` | `name:` → `:player :name` | `:player` | – |
| `player.tile` | `[player.worldX, player.worldZ, player.level]` | `tile: x, y, plane p` → `[:tile] + :plane` | `:tile` (WorldPoint str, parse `x=…, y=…, plane=…`) | – |
| `player.hp` | `[hp, maxHp]` | `hitpoints: a/b` | `:hp [boosted real]` | – |
| `player.prayer` | `prayers` (active list), level via `skills` | `prayer: a/b` | `:prayer` (boosted only) | – |
| `player.run` | `runEnergy` (0–100), run flag n/a | `run energy`, `run: on/off` | `:run-energy` (÷100 already) | – |
| `player.anim` | `animId` | `animation:` | – | – |
| `player.interacting` | `combat.targetIndex/targetType` (index only) | `interacting with: Name` | – | – |
| `skills.<S>.level` | `skills[].baseLevel` (`level` = boosted) | `levels: S n, …` | `:levels {"S" n}` (UPPERCASE) | – |
| `skills.<S>.xp` | `skills[].experience` | **absent** | via `osrs.game/skills` (xp-of) | – |
| `inventory[]` | `inventory[{slot,id,name,count,optionsWithIndex}]` | `slot i: n x Name … actions:` | – | – |
| `equipment` | `equipment[]` (slot numbers) | `slotname: 1 x Name` | – | – |
| `npcs[]` | `nearbyNpcs[{id,index,name,x,z,optionsWithIndex}]` | `Name id N index I tile x,y … actions:` | – | – |
| `objects[]` | `nearbyLocs[{id,name,x,z,level,optionsWithIndex}]` | `Name (object id N) tile x,y … actions:` | – | – |
| `ground[]` | `groundItems[{id,name,count,x,z}]` | `n x Name tile x,y … actions:` | – | – |
| `dialogue` | `dialog{isOpen,options,…}` | `## Dialogue` widget text lines | – | – |
| `chat[]` | `gameMessages[]` / `sdk.getChat()` | `## Chat` | – | `source:"log"` lines if `LAB_GAME_FILE` is set |
| `screen` (OSRS only) | n/a (no pixels) | `## Screen` origin, scale, camera | – | – |
| `control.holder` | `getConnectionMode()` + takeover events | inferred: human input in the last N s (`hands\hand\auto_idle.txt`) | – | `type:"handover"` events (new) |
| `run.splits` (Dragonwilds) | – | – | – | `finish.splits[]`. `split` text parsed with `/^(.+) (\d+:\d+\.\d+)$/` |

Coordinates line up: rs-sdk `worldZ` is OSRS `y`, and `level` is `plane`. IDs (NPC/object/item) **do not** carry over between 2004scape and OSRS. Match on names and use `id` within a single source only.

### 2.2 Action mapping (Decide → effectors)

Common action: `{ "kind":"act", "agent":"<id>", "verb":"interact|walk|use|use-on|drop|take|dialog|key|say|wait", "target":{"section":"npcs|objects|ground|inventory|widgets","name":…, "id":…, "index":…, "tile":[x,y,p], "slot":…}, "option":"Talk-to", "reason":"<intent, quoted from plan>" }`

| Common verb | rs-sdk | OSRS `requests.md` (perform.py) | OSRS client_repl |
|---|---|---|---|
| `interact` npc | `bot.interactNpc(name, option)` or `{type:'interactNpc', npcIndex, optionIndex}` (optionIndex = `optionsWithIndex.find(o=>o.text===option).opIndex`) | `## NPCs on screen` / `- <entry line as in present.md>` / `    action: Talk-to` | read-only by policy. Not used to act (see Risks) |
| `interact` object | `bot.interactLoc(name, option)` / `{type:'interactLoc',x,z,locId,optionIndex}` | `## Objects on screen` + entry + `action:` | – |
| `take` | `{type:'pickupItem',x,z,itemId}` | `## Ground items on screen` + entry + `action: Take` | – |
| `use` (inventory) | `{type:'useInventoryItem',slot,optionIndex}` | `## Inventory` / `- slot i: …` / `action: Eat` | – |
| `drop` | `bot.dropItem(name, n)` | `## Inventory` … `action: Drop` | – |
| `use-on` | `useItemOnLoc` / `useItemOnNpc` | two requests: `action: Use` on the item, then the target's `Use` row | – |
| `walk` | `{type:'walkTo',x,z}` | `live\walk_targets.txt` line `x,y`, then click the minimap point the plugin answers | – |
| `dialog` | `clickDialogOption{optionIndex}` / `navigateDialog([...])` | `## Interface options` `- widget … action: Continue` | – |
| `key` | – | `## Key` / `    action: space` | – |
| `say` | `{type:'say',message}` (allowed in observe mode) | not allowed (no chat effector) | – |
| `reason` | `BotAction.reason` (required) | kept in `performed.jsonl` `request` | – |

---

## 3. Code sketches

### 3.1 Clojure (bb): OSRS present.md → common frame → bridge feed

Runs beside the bridge. It reuses the OSRS project's own parser read-only by putting `clj/src` on the classpath. It does not modify that project.

```clojure
;; bb -cp D:/labyrinth/Github/SmilePrompt/Composer/osrs/clj/src scripts/osrs_feed.clj  (sketch, not installed)
(ns osrs-feed
  (:require [osrs.mirror :as m] [cheshire.core :as json] [babashka.http-client :as http]))

(defn ->tile [{:keys [tile plane]}] (when tile (conj tile (or plane 0))))
(defn ->frame [f]
  (let [p (:player f)]
    {:kind "obs" :src "osrs-mirror" :wall (System/currentTimeMillis) :tick (:tick p)
     :player {:name (:name p) :tile (->tile p) :hp (:hitpoints p) :prayer (:prayer p)
              :run {:energy (:run-energy p) :on (:running? p)} :anim (:animation p)
              :interacting (:interacting p)}
     :skills (into {} (for [[k v] (:levels p)] [(name k) {:level v :xp nil}]))
     :inventory (:inventory f) :equipment (:equipment f)
     :npcs (:npcs f) :objects (:objects f) :ground (:ground f)
     :dialogue (:dialogue f) :chat (take-last 10 (:chat f))}))

(defn post! [ev]
  (http/post "http://127.0.0.1:5180/api/feed"
             {:headers {"Content-Type" "application/json"} :body (json/generate-string ev)}))

;; Only post when the tick changes, to keep the feed (300-event ring) useful.
(defonce last-tick (atom nil))
(defn step! []
  (let [fr (->frame (m/frame))]
    (when (not= (:tick fr) @last-tick)
      (reset! last-tick (:tick fr))
      (post! {:source "osrs" :type "frame" :text (str (get-in fr [:player :name]) " @ " (get-in fr [:player :tile]))
              :frame fr}))))
```

XP enrichment over 7889 (read-only), using the project's own `osrs.game` (`skills` / `xp-of` exist there. Confirm the return shape before wiring this up; the sketch assumes a map of skill name → xp):

```clojure
(require '[osrs.game :as g])
(defn with-xp [fr] (update fr :skills #(merge-with merge % (into {} (for [[s xp] (g/skills)] [s {:xp xp}])))))
```

Bridge-side change needed later (not done, scripts/ is out of scope for this pass): `snapshot-form` should add `:tick (.getTickCount c)` and `:xp` so the 3 s poll is enough for scoring.

### 3.2 TypeScript (bun): rs-sdk observer → bridge feed

```ts
// observe-only; never pre-empts the controller (rs-sdk SDKConnectionMode 'observe')
import { BotSDK } from './rs-sdk/sdk/index';
const sdk = new BotSDK({ botUsername: 'agent', password: 'test', gatewayUrl: 'ws://localhost:7780',
                         connectionMode: 'observe', autoLaunchBrowser: false });
await sdk.connect();
let lastTick = -1;
sdk.onStateUpdate(s => {
  if (!s.player || s.tick === lastTick) return; lastTick = s.tick;
  const frame = {
    kind: 'obs', src: 'rs-sdk', wall: Date.now(), tick: s.tick,
    player: { name: s.player.name, tile: [s.player.worldX, s.player.worldZ, s.player.level],
              hp: [s.player.hp, s.player.maxHp], run: { energy: s.player.runEnergy, on: null }, anim: s.player.animId },
    skills: Object.fromEntries(s.skills.map(k => [k.name, { level: k.baseLevel, xp: k.experience }])),
    inventory: s.inventory.map(i => ({ slot: i.slot, name: i.name, count: i.count, actions: i.optionsWithIndex.map(o => o.text) })),
    npcs: s.nearbyNpcs.map(n => ({ name: n.name, id: n.id, index: n.index, tile: [n.x, n.z, s.player!.level], actions: n.optionsWithIndex.map(o => o.text) })),
    objects: s.nearbyLocs.map(l => ({ name: l.name, id: l.id, tile: [l.x, l.z, l.level], actions: l.optionsWithIndex.map(o => o.text) })),
    ground: s.groundItems.map(g => ({ name: g.name, count: g.count, tile: [g.x, g.z, s.player!.level] })),
  };
  fetch('http://127.0.0.1:5180/api/feed', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'rs-sdk', type: 'frame', text: `${frame.player.name} @ ${frame.player.tile}`, frame }) });
});
```

### 3.3 Common action → OSRS `requests.md` (Python, offline formatter only)

```python
SECTION = {"npcs": "NPCs on screen", "objects": "Objects on screen", "ground": "Ground items on screen",
           "inventory": "Inventory", "widgets": "Interface options"}

def to_request(act, frame_text_entries):
    """frame_text_entries: {section_title: [raw '- …' lines]} from present.md.
    Re-finds the live entry by identity (name + id/index/slot), as perform.py does."""
    if act["verb"] == "key":
        return f"## Key\n    action: {act['option']}\n"
    sec = SECTION[act["target"]["section"]]
    t = act["target"]
    def match(line):
        if "slot" in t: return line.startswith(f"- slot {t['slot']}:")
        ok = t["name"] in line
        if t.get("id") is not None: ok &= (f"id {t['id']}" in line)
        if t.get("index") is not None: ok &= (f"index {t['index']}" in line)
        return ok
    line = next((l for l in frame_text_entries.get(sec, []) if match(l)), None)
    if line is None:
        return None            # target not present: log as skipped, do not guess
    return f"## {sec}\n{line}\n    action: {act['option']}\n"
```

### 3.4 Common action → rs-sdk

```ts
async function perform(bot, sdk, a) {
  switch (a.verb) {
    case 'interact': return a.target.section === 'npcs'
      ? bot.interactNpc(a.target.name, a.option) : bot.interactLoc(a.target.name, a.option);
    case 'walk': return bot.walkTo(a.target.tile[0], a.target.tile[1]);
    case 'drop': return bot.dropItem(a.target.name, a.count ?? 'all');
    case 'say':  return sdk.sendSay(a.text);
    default: return { success: false, reason: 'unsupported_verb' };
  }
}
```

---

## 4. Handover manual ↔ auto: one control token

Each existing system already has a handover primitive:

| System | Human → agent | Agent → human |
|---|---|---|
| OSRS hands (`hands\NOTES.md`) | "Auto mode waits for 8 s without mouse or keyboard input, takes the mouse" (idle threshold in `hands\hand\auto_idle.txt`, set with `--idle N`) | "hands back the instant Hanjo moves it". It also stops when the cursor is found away from where it left it. |
| rs-sdk | a `control` connection takes over (the newest controller wins, commit db0cc51e logs out the replaced client) | the agent disconnects, or the human's client takes over. `observe` never pre-empts. |
| Dragonwilds lab | no game API: the human always plays. The agent's "auto" is the navigator/coach and the timer. | the human presses split, undo or reset |

Unified event, which we post to the bridge as `{source:"<sys>", type:"handover"}`:
`{ "kind":"handover", "from":"human|agent:<id>", "to":"…", "cause":"idle|input|takeover|request|error|finish", "t":…, "latency_ms":…, "state_ok":true }`

---

## 5. Benchmark harness spec (sangha on RuneBench-style tasks)

### 5.1 Task schema (`data/kb/prior/benchmark-tasks.json` follows this)

```json
{
  "id": "rs-woodcutting-xp-15m",
  "family": "runebench-compatible | osrs-mirror | dragonwilds-raid | sangha-coop | handover",
  "env": { "kind": "rs-sdk-local | osrs-observe | dragonwilds-human", "speed_factor": 8, "xp_multiplier": 25,
           "start_state": "agent.sav | live-account(read-only) | raid-lobby", "network": "127.0.0.1 only" },
  "instruction": "Natural-language task text given to the agents verbatim.",
  "constraints": [ { "id": "no-teleport", "text": "…", "check": "count(act.verb=='teleport') == 0", "hard": true } ],
  "roles": [ { "id": "gatherer", "min": 1 }, { "id": "processor", "min": 1 } ],
  "handover": { "allowed": true, "policy": "human-priority", "yield_deadline_ms": 600, "idle_takeover_s": 4 },
  "horizon_s": 900,
  "success": { "type": "predicate | threshold | splits", "expr": "…" },
  "metrics": { "primary": "peak_rate_15s | final_value | run_time | splits", "skill": "Woodcutting" },
  "targets": { "par": null, "target": null, "record": null },
  "weights": { "success": 0.4, "speed": 0.25, "adherence": 0.2, "cooperation": 0.1, "handover": 0.05 },
  "sources": ["https://github.com/MaxBittker/runebench"]
}
```

### 5.2 Episode log format

One JSONL file per episode (`live/episodes/<task>/<episode>.jsonl`). The first line is a header and the last line is the score. Every other line uses the bridge feed event shape plus fields, so `POST /api/feed` can carry it unchanged (`source` = agent/system, `type` = `kind`).

```jsonl
{"kind":"header","task":"dw-raid-beat-wr","episode":"2026-11-03T20:00:00Z-01","agents":["navigator","coach","scout"],"human":"runner","commit":"db5c89a"}
{"kind":"obs","t":0,"src":"dw-app","frame":{"run":{"phase":"running","index":0}}}
{"kind":"msg","t":1200,"agent":"coach","to":"runner","text":"Vines: hug left wall, sprint-jump at the stump","ref":"route:vines-1"}
{"kind":"act","t":1300,"agent":"navigator","verb":"show","target":{"clip":"vines-1"},"reason":"pre-cue next skip"}
{"kind":"split","t":81900,"index":1,"name":"Dragontail Vines","run_s":81.9,"source":"app"}
{"kind":"handover","t":90000,"from":"human","to":"agent:navigator","cause":"request","latency_ms":180}
{"kind":"note","t":95000,"agent":"scout","text":"Patch 1.0.1.2: ledge clip still works"}
{"kind":"score","t":409000,"success":1,"speed":0.99,"adherence":1.0,"cooperation":0.82,"handover":1.0,"total":0.95}
```

Required keys: `kind`, `t` (ms since episode start). `wall` (epoch ms) is optional; the bridge's `at` fills it. Event kinds: `header, obs, act, result, msg, split, handover, violation, note, score`.

### 5.3 Metrics and formulas

All metrics are in [0,1] unless noted.

**Success** `S`
- predicate tasks: `S = 1` if `success.expr` holds at the end of the episode (or at any point, for "reach" tasks), else `0`.
- threshold tasks: `S = min(1, value / target)`.
- RuneBench-compatible: report the raw `peak_rate` (real-game XP/min) too, and `S = 1` if `peak_rate > 0`.

**Speed** `V`
- rate tasks (RuneBench): `V = ln(1+peak_rate) / ln(1+ref_rate)`, capped at 1. `ref_rate` is the best published RuneBench value for that skill, or our own record.
  `peak_rate = max_i (xp_i − xp_k)/(t_i − t_k) × 60000 / speed_factor / xp_multiplier`, where *k* is the nearest earlier sample with `t_i − t_k ≥ 12000` (same as `check_skill_xp.ts`).
- completion tasks: `V = 1` if `T ≤ T_target`, else `exp(−(T − T_target)/τ)`, with τ given per task (raid: τ = 15 s). `V = 0` if not completed.

**Instruction adherence** `A`
`A = hard_ok × (Σ_c w_c·pass_c) / (Σ_c w_c)` over the soft constraints. `hard_ok = 0` if any `hard: true` constraint is violated. Each `act` must carry a `reason` (as in rs-sdk). Acts with an empty reason count as a soft violation of the implicit constraint `explain-actions`, weight 0.5. LLM-judged constraints are allowed only when tagged `"judge":"llm"`, and are reported separately as `A_judge`.

**Cooperation** `C` (sangha tasks only; `C = 1` when there is one agent)
```
coverage   = (#roles with ≥1 productive act) / (#roles required)
balance    = 1 − Gini(productive acts per agent)
handoffs   = (#cross-agent dependencies satisfied, e.g. items passed/used) / (#dependencies requested)
conflict   = (#ticks with ≥2 controllers on the same character or the same target) / (#ticks)
defection  = 1 if any agent breaks a declared commitment (trade not honoured, lie in msg vs log), else 0
C = (0.35·coverage + 0.15·balance + 0.5·handoffs) × (1 − conflict) × (1 − 0.5·defection)
```
(The defection term comes from the cheating-agent finding reported in Bittker's RC talk.)

**Handover** `H` (tasks with `handover.allowed`)
```
for each handover h:
  yield_ok_h  = 1 if (to == human) and latency_ms ≤ yield_deadline_ms else (0 if to==human)
  take_ok_h   = 1 if (to == agent) and agent's first act ≥ idle_takeover_s after last human input
  continuity_h = 1 if state_ok (no lost inventory/position/timer state across the switch)
  intrude      = # agent acts while holder == human     (must be 0)
H = mean_h( mean(applicable of yield_ok, take_ok, continuity) ) × (intrude == 0 ? 1 : 0)
```
For the Dragonwilds lab, "holder" is who owns the **split timer and the route cursor**: the runner pressing keys (manual) or the agent auto-advancing from detected triggers (auto). A human split, undo or reset always wins.

**Total**
`Total = S_gate × (w_S·S + w_V·V + w_A·A + w_C·C + w_H·H)`, where `S_gate = 0` if any hard constraint was broken, else 1. Default weights are 0.4 / 0.25 / 0.2 / 0.1 / 0.05, and each task can override them. For RuneBench comparability, also report `agg = mean_skills ln(1+peak_rate)` across the 16 skill tasks.

```python
import math
def peak_rate(samples, skill, speed=8, mult=25, min_ms=12000):
    best = 0.0
    for i in range(1, len(samples)):
        k = next((k for k in range(i-1, -1, -1) if samples[i]["t"] - samples[k]["t"] >= min_ms), None)
        if k is None: continue
        dxp = samples[i]["xp"][skill] - samples[k]["xp"][skill]; dt = samples[i]["t"] - samples[k]["t"]
        if dxp > 0 and dt > 0: best = max(best, dxp / dt * 60000 / speed / mult)
    return round(best)

def speed_completion(T, T_target, tau): return 0.0 if T is None else (1.0 if T <= T_target else math.exp(-(T - T_target) / tau))
def total(m, w, hard_ok): return (1 if hard_ok else 0) * sum(w[k] * m[k] for k in w)
```

### 5.4 Dragonwilds raid as a task

The data comes from `js/data/raid.js`: `SPLITS` (5), `TARGET_SPLITS = [82.7, 143.2, 195.7, 282.3, 408.1]` (6:48.1), WR TexasPete `410.0` with splits `[81.52, 142.62, 194.32, 290.62, 410.0]`, and timing rules in `RULES` (start = loading icon disappears; end = cut to black after "GET OUT NOW!").

- **Env** `dragonwilds-human`: the human runner is the only actuator. The sangha agents are **navigator** (advances the route cursor and cues clips), **coach** (per-skip callouts), **scout** (patch and route validity), and **timer** (splits from app events, or auto-split from banner detection if added later).
- **Observation**: bridge feed events `run-start`, `split`, `finish`, `reset`, `segment`, `practice`, plus `snapshot` (null for Dragonwilds).
- **Success**: `finish` event with 5 splits, no undo after the final split, run valid under `RULES` (video recorded). `S ∈ {0,1}`.
- **Speed**: `V = speed_completion(T, 408.1, 15)`. Per split *j*, `seg_j = split_j − split_{j−1}` and `Δ_j = seg_j − target_seg_j` are reported (not scored), so the KB can learn where time goes. Flags: `beats_target = T ≤ 408.1`, `beats_record = T < 410.0`.
- **Adherence**: the coach and navigator follow the route version gate (no callout for a skip marked broken in the current patch, hard), keep callouts ≤ 12 words (soft), and stay silent during the "do not talk" windows the runner sets (soft).
- **Cooperation**: dependencies are "scout validates route before run-start" and "navigator cue precedes coach callout for the same skip". Conflict means two agents cueing different skips at the same time.
- **Handover**: the runner can take the timer manually (key press), and the agent may only auto-split when the runner has handed it over. Yield deadline 300 ms.
- **Reset tasks**: a reset in split *j* gives `S = 0`. The episode still scores `A`, `C`, `H`, and logs `reset_at_split = j` to feed `data/kb/analysis/reset-thresholds.csv`.

### 5.5 Running the harness (proposed, not implemented)

1. `bb lab` (bridge up). Each agent posts `msg`/`act` events to `/api/feed` with `source = agent id`.
2. A scorer (Python `-I` or bb) tails `live/feed.jsonl` between the `header` line and `finish`/`reset`/horizon, writes `live/episodes/<task>/<ep>.jsonl`, and appends the `score` line.
3. The leaderboard view reads the episode scores (future `js/` work, out of scope here).

## 6. Risks (adapter-specific)

- **Live OSRS is real Jagex servers.** The OSRS project's hands send real input to a real account, and that is a ToS question this lab should not inherit. Our adapters read OSRS (mirror and REPL) and only *format* requests. Benchmark episodes that need an agent to act should run in the rs-sdk local sandbox. The bridge's `/api/eval` evaluates arbitrary code in the game client. Keep it 127.0.0.1-only and never expose it to agent tools in benchmark runs.
- **Hard-coded C: paths.** `present.md` and the OSRS scripts use `C:\Users\hanjo\Claude\Projects\osrs\…`. The adapter must take the mirror path as a parameter (`osrs.mirror/present-path` already supports an active-character dir). Under our rules, nothing here writes to C:.
- **Feed ring of 300.** `/api/feed` keeps only 300 events in memory and returns 100. Scorers must read `live/feed.jsonl`, not the HTTP view.
- **Split text parsing.** `split` events carry only text. A numeric `splitIndex`/`runS` in `emit('split', …, {…})` would make scoring robust. That is a later `js/` change.
- **Untrusted chat.** In-game chat and agent messages are untrusted input. Never feed them into tool calls unfiltered.
