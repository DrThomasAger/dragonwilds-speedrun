# Content Pillars: Beat 6:50

Series: **Beat 6:50** (Ghost internal tag `#beat-650`). Goal: teach a reader to beat TexasPete's **6:50.000** Scorned Wilderness raid record (speedrun.com Raid, 1.0.0.6+) on the current patch, and to get every requirement the route uses.

Pillars are ordered by **reader need**: the order a runner hits each problem. A reader who has never entered the raid starts at Pillar 1. A runner already doing 8-minute runs starts at Pillar 3 or 5.

The data shaped the pillars in three ways:

- **The record sits on patched routes.** TexasPete's 6:50 predates 1.0.1. Nanobit's 7:01 is the best run on a route that still mostly works. So the Route pillar teaches the 1.0.1.2 route (Nanobit's skeleton plus Dotxy's flight), and the Data pillar compares the two records split by split.
- **Movement tech is its own pillar.** Every 1.0.1+ skip is built from a handful of primitives: the zoop, the dive cancel, the infinite double jump, Surge plus Phase Dash, the windjump. Teaching them once, separately, keeps each route post short.
- **Patches move fast.** Four raid-relevant patches landed in five weeks. Patch Watch is a pillar so each route post can link to one place that says what still works.

| # | Pillar | Ghost tag (slug) | Posts | Reader need | Reader question it answers |
|---|---|---|---|---|---|
| 0 | Start Here (series hub) | `beat-650` | 1 (00) | Orientation | "How do I beat the 6:50 world record?" |
| 1 | **Get Raid-Ready** | `get-raid-ready` | 6 (01-06) | Requirements | "What levels, spells, items and quests do I need, and how do I get each one?" |
| 2 | **The Route, Split By Split** | `the-route` | 8 (07-14) | Execution | "What do I do in each of the five splits?" |
| 3 | **Movement Tech** | `movement-tech` | 6 (15-20) | Skill | "How do zoops, dive cancels and flight actually work?" |
| 4 | **Practice & Consistency** | `practice` | 4 (21-24) | Repetition | "How do I make the run happen every attempt?" |
| 5 | **Data & The Record** | `data-and-the-record` | 6 (25-30) | Targets | "Where is the 6:50 won, and what pace do I need?" |
| 6 | **Patch Watch** | `patch-watch` | 3 (31-33) | Currency | "What still works on today's patch, and what are the rules?" |

## Pillar 1: Get Raid-Ready

**Promise:** every requirement the route uses, with the level, the cost and how to get it.
Sources: `js/data/route.js` (REQUIREMENTS, GEAR), `js/data/wiki.js`, `js/data/hardcore.js` (phase where each unlock lands), SamFPlays' gear list, official patch notes.
Pending inputs: `data/kb/builds.json`, `docs/builds/*.md` (placeholders in posts 01 and 03 to 06; also in Pillar 4 posts 21 to 24).

## Pillar 2: The Route, Split By Split

**Promise:** the 1.0.1.2 route in the order you play it, one post per skip group, every skip credited to its finder.
Sources: `js/data/route.js` (ROUTE), `js/data/raid.js` (SPLITS, RUNS), SamFPlays' guide and follow-along chapters, zyneater, Sir_Rebral, Nanobit's run notes, Dotxy.
Pending input: `D:\claude-temp\runpath\runpath.md` (skip-level optimal path; placeholders in posts 07 to 14).

## Pillar 3: Movement Tech

**Promise:** each movement primitive defined wiki-style, with the inputs, the finder and the clip.
Sources: Dotxy's three tech videos, SamFPlays' combo chapter, Nanobit's zoop notes, `js/data/wiki.js` (community-tech, jump-attack).

## Pillar 4: Practice & Consistency

**Promise:** a practice loop that turns a skip you landed once into a skip you land every time.
Sources: Raid Lab Practice and Timer pages (README), Nanobit's reset notes, Bazilleos' teleport bug, console input comments.

## Pillar 5: Data & The Record

**Promise:** where every second of the record goes, measured frame by frame, and the pace that beats it.
Sources: `js/data/raid.js` (RUNS, communityBest, targetPace), Nanobit's 25 timestamped time saves.
Pending inputs: `D:\claude-temp\runpath\runpath.md`, `data/kb/analysis/*`, `docs/math/*` (placeholders in posts 29 and 30).

## Pillar 6: Patch Watch

**Promise:** what each patch did to the route, quoted from Jagex, and the speedrun.com rules that decide what counts.
Sources: `data/patchnotes.json`, `js/data/raid.js` (PATCHES, RULES), `data/kb/raw/speedrun/rules.json`, `D:\claude-temp\register\raid-sources.md`.

The full post list with status lives in `INDEX.md`.
