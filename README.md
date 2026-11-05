# Dragonwilds Raid Lab

**Live:** https://drthomasager.github.io/dragonwilds-speedrun/ · install it from there as an app.

Scorned Wilderness raid speedrun lab for RuneScape: Dragonwilds, built to take the #1 spot on the speedrun.com Raid board (1.0.0.6+). The current record is **6:50.00** (TexasPete).

| Phone (Fold folded) | Fold unfolded | Desktop |
|---|---|---|
| ![](docs/screens/phone/run-live.png) | ![](docs/screens/fold/route.png) | ![](docs/screens/desktop/hq.png) |

## Aero, for any website

`aero/` is the Frutiger Aero kit this site is dressed in, gathered so any other site can use it: `aero.css` (wallpaper, glass, 2.5D depth, controls, gradient and bubble text, the sea with dolphins), `aero.js` (the sea, tilt and parallax), and the Blog Template from drthomasager.com set on Aero glass. `aero/README.md` says how to use it, and the specimen page shows every piece: https://drthomasager.github.io/dragonwilds-speedrun/aero/

## Install it as an app

It's a PWA. Open the site, then:
- **Pixel / Android (Chrome):** ⋮ → *Install app*, or tap **⤓ Install app** in the header. Works folded (phone layout, bottom tabs) and unfolded (rail layout). Turn on 🔔 on the Patch notes page to get an alert when a new patch touches the raid.
- **Windows (Edge or Chrome):** use the install icon in the address bar, or **⤓ Install app**. It opens in its own window and has shortcuts for Run, Race the WR, Timer and Patch notes.

It works offline for everything except the YouTube clips and the live leaderboard.

## Claude inside the app (your PC only)

```bash
bb lab          # or: npm run lab  ->  http://localhost:5180
```

This starts the **bridge** (`scripts/bridge.clj`, babashka). Open http://localhost:5180 and press **✦** (Ctrl+J):
- **Chat:** tell Claude what you want, Figma Make style, e.g. "make the split button bigger" or "why was my last run slow?". It edits the app on its own (auto permission mode), takes a screenshot to check its work (`scripts/look.mjs`), and the open app reloads by itself.
- **Live feed:** your splits, PBs, resets and practice results stream in as you play, so Claude knows what's happening. If RuneLite is running with the OSRS `client_repl` plugin (port 7889), it also polls a live game snapshot. The bridge also tails these append-only files live (one feed event per new line, within a second):
  - `data/kb/raw/ingest-log.jsonl`: every new run, comment, video and post the knowledge-base ingesters find, so a local or hourly ingest shows up as it lands.
  - `data/kb/raw/twitch/live-*.jsonl`: runners' live Twitch chat. The bridge starts `scripts/ingest/twitch-live.mjs` itself (`LAB_TWITCH_LIVE=0` turns it off).
  - `LAB_OSRS_EVENTS`: OSRS tick-monitor files, e.g. `C:\Users\hanjo\Claude\Projects\osrs\tick_monitor\live_*\segments.jsonl`. Globs work, and several paths go in separated by `;`.
  - `LAB_GAME_FILE`: any other log or state file, with globs and `;` the same way.

  A file that already exists is read from its end. A file that appears later is read from its start. `/api/status` shows how many files each source is tailing (`tails`).
- **REPL:** run Clojure inside the game client. The bridge has its own nREPL on `localhost:1667` for your editor too.

Everything listens only on 127.0.0.1. The public website doesn't show the panel.

## Voice: read-aloud and spoken call-outs

Every page has **🔊** in the top bar: it reads the page that is open (its main content, not the menus). Press it again, or **Ctrl+Shift+Esc** anywhere, to stop. **🗣** opens the voice settings: mute everything, the voice engine, the Breeze address and voice, the browser voice and the speed. Settings stay in this browser (`localStorage` key `speak_prefs_v1`).

- **Run navigator and Timer:** each split is spoken with its time and your pace against the comparison ("Fragments of Ghornfell, 1:21.4. 2.3 seconds behind versus Beat 6:50 pace. Next: ..."), plus the start, the finish, undo and reset. The **🔊 Call-outs** button (or **S** in the navigator) turns this on and off.
- **Claude panel:** finished replies are read aloud. The **🔊 Speak** button in the panel header turns it off.

All of it is one module, `js/lib/speak.js` (no imports; the same file is in `smile-arena/site/js/speak.js`). It asks **Breeze TTS 2** on Ganesha first and falls back to the browser's own voice (Web Speech API), so it works offline and on phones:

- Default address `http://buddhafield:8137` (Ganesha over Tailscale). `GET /health` is checked with a 1.5 s timeout and remembered for a minute; speech is `POST /v1/audio/speech` with `{"model":"tts-1","input":"...","response_format":"pcm","seed":1717}` (16-bit mono PCM at 24 kHz, the same call as `THE MAP Viewer/src/mapview/speech.clj`). The next sentence is fetched while the current one plays.
- For Breeze to answer another device, `breeze-server.exe` must listen on the tailnet address, not only 127.0.0.1, and send CORS headers; otherwise put a small proxy in front of port 8137. An https page (the public GitHub Pages site) cannot call an http address, so there the browser voice speaks; Breeze is used from `npm start` / `bb lab` on http.

## Ekadanta feed

```bash
npm run ekadanta              # node scripts/ekadanta-export.mjs   [--dry-run] [--all]
```

Writes every **new or changed** blog post (`content/blog/posts`), knowledge-base page (`data/kb/pages.json`) and daily note (`data/kb/daily.json`) to `D:\labyrinth\ekadanta-inbox\dragonwilds\<YYYY-MM-DD>.jsonl` (set `EKADANTA_INBOX` to change the root). One JSON document per line:

```json
{"source":"dragonwilds-speedrun/kb","title":"...","text":"...","url":"https://...","ts":"2026-11-03T08:27:00.000Z","id":"kb:...","project":"dragonwilds","tags":["dragonwilds","raid-lab","speedrun","kb"],"private":false}
```

`.exported.json` in that folder keeps a hash per `id`, so a second run writes nothing until a text changes; a changed text is written again as a new line (a new version). Nothing in the inbox is ever deleted.

**How Ganesha's Ekadanta takes it in:**
1. Bring the inbox to Ganesha (it is on Karuna's D: drive): sync `D:\labyrinth\ekadanta-inbox\` to a folder on Ganesha over Tailscale (Syncthing, or `robocopy` to a share on `buddhafield`).
2. Add a reader to `Ekadanta Service` in the same pattern as `smile_reader.py`: for each `*.jsonl` file, for each line, hand one thing to `store.py` (the one writer) with `source` as the source, `title`, `text` as the rendering, `url`, `ts` as the time, and `tags` as tags (every SMILE text carries `smile`). Use `id` + the text's hash as the thing's key so a line seen twice is one thing and a changed text becomes a new version.
3. A line with `"private": true` goes under the `Private` folder: recorded, never returned.
4. Remember the byte offset read in each file, so the reader picks up only new lines (the files are append-only).

## Run it

```bash
npm install     # dev only: Playwright test runner (uses your installed Edge)
npm start       # http://localhost:5173
```

The site has no build step and nothing to bundle. It has to be served over http, because ES modules and the YouTube iframe API both fail on `file://`. GitHub Pages serves the `gh-pages` branch. `.github/workflows/publish.yml` copies `main` there on every push, and the hourly patch-notes job publishes too.

## What's in it

| Page | What it does |
|---|---|
| **Run navigator** | An in-raid second screen with one giant split button. It shows the skip you're on with large-print steps and a muted looping reference clip, your live delta against the WR (or your PB), and a pre-flight checklist. Runs save to the same history as the Timer. |
| **HQ** | Shows the live #1 from speedrun.com, the community sum of best (the fastest segment from any record, 6:38), where each record's time goes per split, and where #1 is won, with sources. |
| **Race the WR** | Plays up to 4 runs on one run clock. *Race* puts every video on the same timer value. *Split-aligned* starts every segment together, and faster runs wait on their split. Shows live deltas. Split marks can be adjusted live (±0.1 s, "= now") and every change re-syncs instantly. You can add your own run from a YouTube link and mark its splits with Z/S while watching. |
| **Route** | The 1.0.1.2 route split by split: each skip, how to do it, whether it still works, and its clips. It also has a **requirements timeline**: every skill, spell, item and quest the route needs, grouped by the Hardcore phase that unlocks it, with ticks for what you already have. |
| **Reel Studio** | Plays clips from any videos back to back with no gap: the next clip is pre-buffered on a hidden second player and cut in on the out-point. Drag in/out handles and the video follows the handle. You can preview each cut, loop a clip solo, reorder, share by link, and export/import. Presets include the 6:38 composite and each split across every record. |
| **Practice** | Loop a skip's reference clip and log made (J) or missed (K). Consistency is tracked per skip, and the weakest skip is suggested next. |
| **Timer** | A split timer with LiveSplit behaviour, golds and PB. It exports a `.lss` with the WR, Nanobit and the community sum of best as LiveSplit comparisons, and imports `.lss` history to analyse where your runs die. |
| **Mechanics wiki** | 45 sourced entries covering the movement kit, spells, stamina, items, every raid zone and boss, and engine and speedrun rules. Each entry links to the skips that use it and pulls matching lines from the live patch notes. |
| **Patch notes** | Official Jagex notes from Steam, mirrored hourly by a GitHub Action (`.github/workflows/patchnotes.yml`). The app refreshes them on open, every hour while open, and when you return to it, and the service worker refreshes them on close. Raid and movement lines are flagged, and the page warns when a patch is newer than the route's verified version. |
| **Library** | 45 videos with verified ids, durations and creator chapters, playable as clips. |
| **Hardcore 1→Max** | The account route checklist, with clips re-timed to real chapters. |
| **Hardcore Run mode** (`hardcore-run.html`) | The in-game companion: one step at a time, prep / run / review, pre-flight checklists, full-screen danger rules, undo. It uses the same data and progress as the checklist. |

Press `?` on any page to see its keyboard shortcuts.

## How the split data was measured

Every run's splits sit on the same trigger: the first frame showing the "EXTRACTION POINT UNLOCKED" banner (splits 1–4), and the cut to black after "GET OUT NOW!" (split 5, which is speedrun.com's end rule). Banner frames were found by template matching at 10 fps and then checked frame by frame. Each video's timer offset comes from reading the on-screen timer at 3+ frames. Precision is ±0.1 s. See `js/data/raid.js`.

## Tests

```bash
npm test               # end-to-end tests (incl. tests/speak.spec.js, speech mocked) at phone / Fold / desktop sizes + screenshots → docs/screens/<size>/
npm run test:youtube   # real YouTube embeds: cross-video cut + 2-video race sync
npm run check          # re-verify every video id is still live
npm run patchnotes     # refresh data/patchnotes.json from Steam
```

Not affiliated with Jagex. Every clip plays from its creator's channel and every skip credits its finder.
