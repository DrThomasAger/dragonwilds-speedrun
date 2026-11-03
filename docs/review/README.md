# Raid source review pipeline

Reviews every raid run / video the lab knows about — including rejected, unranked and
casual full runs — to measure splits, flag segments that do not fit the reference runs,
and harvest commentary that mentions techniques. Output per source:

- `data/kb/reviews/<id>.json` — `{id, url, title, author, rank, runStatus, duration, splits, segmentTimes, anomalies, blackouts, commentary, textNotes, candidateMechanics, quality, reviewedAt, …}`
- `docs/review/<id>.md` — the same, readable, with timestamped links
- `data/kb/reviews/index.json`, `docs/review/index.md` — one row per source
- `data/kb/reviews/_state.json` — reviewed ids and the level reached (the queue skips them)
- `data/kb/reviews/_search.json` — cached YouTube search hits (refreshed after 20 h)
- `data/kb/reviews/_notes.json` — hand-written observations after looking at the contact
  sheets (`anomalies[<segment>]`, `candidates[<t>] = {verdict, seen}`, `summary`); merged
  into the review the next time it is generated

## Running it

```sh
node scripts/review/run.mjs                    # full review of everything pending
node scripts/review/run.mjs --list             # show the queue (priority, state, source)
node scripts/review/run.mjs --only=6WEIHo7AUf0 --force
node scripts/review/run.mjs --min-priority=40  # runs + guides only
node scripts/review/run.mjs --light            # what CI does: captions + keyword mining, no video
node scripts/review/run.mjs --watch            # hourly loop (--every=MINUTES)
npm run test:review                            # node --test tests/review
```

### Alongside `bb lab`

`bb lab` serves the app and the Claude panel; run the review loop next to it so new
sources are reviewed while you practise:

```sh
bb lab                                   # terminal 1
node scripts/review/run.mjs --watch      # terminal 2 (or: npm run review -- --watch)
```

or start it from the lab's babashka REPL so it lives and dies with the lab:

```clojure
(require '[babashka.process :as p])
(def review (p/process ["node" "scripts/review/run.mjs" "--watch"] {:inherit true}))
;; stop: (p/destroy-tree review)
```

### CI

`.github/workflows/review.yml` runs daily (and on demand): queue + YouTube search,
captions and keyword mining (`--light`), the unit tests, then commits
`data/kb/reviews` + `docs/review` and pushes to `main` and `gh-pages`. Video steps
need ffmpeg + OpenCV and stay local; a later local full review upgrades light reviews.

## Local tools (nothing on C:)

Everything lives under `D:\claude-temp\review` (`REVIEW_HOME` overrides): `venv`
(numpy, opencv-python-headless, yt-dlp, faster-whisper), `vid` (360p downloads),
`subs` (yt-dlp info + json3 captions), `work` (feature + whisper caches), `frames`
(contact sheets), `hf` (whisper models), `tmp`, `pip-cache`. Child processes get
`TEMP`/`TMP`/`PIP_CACHE_DIR`/`HF_HOME` pointed there. ffmpeg: `D:/ffmpeg/ffmpeg.exe`
(`FFMPEG` overrides). Setup:

```sh
set TEMP=D:\claude-temp\review\tmp & set TMP=%TEMP% & set PIP_CACHE_DIR=D:\claude-temp\review\pip-cache
D:\Python\python.exe -m venv D:\claude-temp\review\venv
D:\claude-temp\review\venv\Scripts\python -m pip install numpy opencv-python-headless yt-dlp faster-whisper
```

## How it measures

1. **Queue** (`queue.mjs`): `data/sources.json`, `data/kb/raw/speedrun/runs.json` (all
   statuses), `data/kb/raw/youtube/*.json` + `_discovered.json`,
   `D:\claude-temp\register\raid-sources.json`, and YouTube searches such as
   "scorned wilderness full run", "kuldra raid full run", "dragonwilds raid no
   commentary". Priority: rejected/new speedrun.com runs > unranked full runs from
   YouTube > low-ranked verified > reference runs > guides > other.
2. **Transcript** (`transcript.mjs`): YouTube captions (json3, word-timed) → local
   faster-whisper (small, CPU int8; falls back to base/tiny when memory is short) →
   the ingest cache's merged caption lines → none. Captions that hit HTTP 429 are retried
   on later runs (`transcriptRetry`).
3. **Frames** (`scan.py`): the video is decoded at 10 fps, 640x360 grey. The
   "EXTRACTION POINT UNLOCKED" **text** template (built from 6WEIHo7AUf0 at 89.2 s by
   `make_templates.py`) is matched by normalised cross-correlation inside the top band;
   the template scale is found per video (UI scale differs: Nanobit 0.91, SamFPlays 1.05).
   The banner's plate and ornament fade in ~0.8 s before the text, so a split is the frame
   where the score jumps from that ~0.6 plateau to >0.7 and holds. The end is the first
   black frame after the "GET OUT NOW!" plate (its own template and scale). The run start
   is the end of the loading screen (last black stretch ≥ 40 s before the first banner);
   reference runs keep their LiveSplit-read offsets from `js/data/raid.js`.
4. **Analysis** (`analyze.mjs`): segments vs the reference distribution (`RUNS`):
   faster than every reference by > 2 s → `faster` anomaly (candidate mechanic);
   > 30 s slower than every reference → `slower`; fewer than 4 banners before the end →
   `missing-banners` (an extraction point bypassed). Black screens inside the run are
   listed (respawns after zoops, deaths, teleports). Contact sheets (12 frames) are cut
   for every anomaly and (8 frames) around candidate transcript lines.
5. **Mining** (`mine.mjs`): transcript lines, description lines, YouTube comments and
   speedrun.com comments/examiner notes are tagged with topics (movement, skip, cancel,
   glitch, trick, timing, mistake, respawn). A line is a **candidate new mechanic** when it
   talks about a skip/clip/glitch/trick/zoop/cancel and does not clearly match a mechanic in
   `js/data/route.js` or `data/kb/glitches.json` (or uses words none of them use).
   Candidates are leads, not facts: check the timestamped link and the contact sheet.
