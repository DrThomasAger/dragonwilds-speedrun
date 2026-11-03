# Bestiary, mechanics and glitch/patch database

This is a knowledge base for the Scorned Wilderness raid speedrun in RuneScape: Dragonwilds. It also covers every other monster that has a wiki infobox. The data is current to game patch **1.0.1.2** (23 Oct 2026) and was researched on 3 Nov 2026.

| File | Contents |
|---|---|
| `data/kb/bestiary.json` | 134 entries. Raid enemies come first in route order, then bosses, then every other monster. Each entry has stats per power level, attacks with tells and counters, phases, weaknesses and immunities, crowd control, respawn, XP, drops, datamined loot, speedrun and normal-play tactics, patch history, and a list of fields that are still `unknown`. Also holds 16 combat-mechanic entries. |
| `data/kb/glitches.json` | 70 glitches, skips, clips, exploits and workarounds, each with status per patch. Also maps 114 official patch posts (Steam, plus wiki mirrors for versions Steam lacks) to the mobs, mechanics and glitches they changed, and lists 6 unofficial or silent hotfixes. |
| [raid.md](raid.md) | Raid enemies in route order, with split names and skip ids from `js/data/route.js` |
| [bosses.md](bosses.md) | Velgar, Imaru, Black Knight Titan, Fuzan, the Nightmare Crucible and minibosses |
| [mobs.md](mobs.md) | Table of every other monster |
| [mechanics.md](mechanics.md) | Snare, Confuse, Enfeeble, parry and stagger, status effects, boss rules |
| [glitches.md](glitches.md) | Glitch catalogue with status by patch and the patch-note line that fixed each one |
| [patches.md](patches.md) | Each patch post with its relevant lines tagged, plus unofficial hotfixes |
| [gaps.md](gaps.md) | What no source states, so it needs in-game measurement |

## Rules the data follows

- Every fact carries a source: `{url, quote, t, date, who}`. The quote is verbatim. For videos, `t` is m:ss and the URL includes `&t=Ns`.
- Auto-caption quotes are copied as captured, including mishearings such as "Coldra" for Kuldra or "garu" for garou.
- No number is invented. Any value no source states is `"unknown"`.
- Status values are `works`, `patched`, `partially-patched`, `unconfirmed` and `works-reported`, and each one needs a dated source for that patch.
- Item duplication entries summarise what the source shows and include no step-by-step instructions.
- Nothing here was measured in-game.

## How it was built

Scratch builders live in `D:\claude-temp\bestiary\scripts` (outside the repo):
- `build_base.py` turns wiki infoboxes, drops, update history and the RSDWArchive datamined loot pages into base entries.
- Curated fragments come from `build_raid_mobs.py`, `build_bosses.py` and `build_glitches.py`. Each one checks every quote against the local copy of its source.
- `map_patches.py` tags patch lines.
- `build_final.py` merges everything, and `gen_docs.py` writes these markdown pages.
