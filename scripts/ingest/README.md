# Knowledge-base ingest

These scripts collect raw source material for the Raid Lab knowledge base into
`data/kb/raw/`. Everything is compact JSON or JSONL. Every script is incremental: it
keeps a `_state.json` and only fetches what is new. Every new item is logged as one line
in `data/kb/raw/ingest-log.jsonl` (`{at, source, kind, id, title}`).

| Script | Source | Output |
|---|---|---|
| `speedrun.mjs` | speedrun.com v1 + v2 API: every Raid run (verified, new, rejected), players, times, videos, runner comment, examiner + reason, run-page comments; game/category/variable rules | `speedrun/runs.json`, `rules.json`, `users.json` |
| `youtube.mjs` | yt-dlp: metadata, chapters, description, transcript (manual subs, else auto json3), top 200 comments, for every Dragonwilds raid / tech / speedrun / boss / patch video in `js/data/videos.js`, `data/sources.json`, speedrun.com runs, `INGEST_EXTRA_SOURCES`, and fresh YouTube searches | `youtube/<id>.json`, `youtube/transcript-index.json`, `youtube/_discovered.json` |
| `twitch.mjs` | runners' Twitch channels (from speedrun.com profiles), their Dragonwilds VODs + VODs linked on runs; chat replay via public GQL; Whisper transcript with `--whisper` | `twitch/<vod>.json`, `twitch/channels.json` |
| `twitch-live.mjs` | live chat, anonymous IRC (`justinfan12345`) over wss | `twitch/live-<channel>.jsonl` |
| `reddit.mjs` | r/Dragonwilds search + comment trees | `reddit/posts.json`, `reddit/<post>.json` |
| `discord.mjs` | RSDW speedrunning Discord via a bot (see `discord.md`) | `discord/<channel>-<id>.jsonl` |
| `run-all.mjs` | all of the above, in order; summary in `last-run.json` | |

## Run

```bash
node scripts/ingest/run-all.mjs                          # everything except Whisper
node scripts/ingest/run-all.mjs --whisper                # + transcribe Twitch VODs locally
node scripts/ingest/run-all.mjs --only=youtube           # one source
node scripts/ingest/youtube.mjs --only=6WEIHo7AUf0       # one video
node scripts/ingest/youtube.mjs --no-comments            # transcripts only (fastest)
node scripts/ingest/youtube.mjs --whisper --no-discover  # + Whisper for videos with no YouTube captions (local)
```

Useful environment variables: `INGEST_YT_MAX` (cap on yt-dlp calls per run),
`INGEST_EXTRA_SOURCES` (extra JSON lists of `{url,title}` to mine for YouTube ids),
`INGEST_WHISPER_MAX_MIN` (default 60: longer VODs are not transcribed),
`INGEST_WHISPER_MODEL` (default `small`), `INGEST_TWITCH_MAX_CHAT` (default 30000),
`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`.

YouTube transcripts are fetched before comments. On HTTP 429 the script backs off
(30 s, 90 s, 270 s). After three 429s in a row it stops and the next run picks up where
it left off. To link a moment, use `transcript-index.json`: each video has `url` and,
per topic (windstep, zoop, heart skip, air door, extraction, …), the seconds where the
transcript mentions it. The link is `url + "&t=" + Math.floor(t) + "s"`.

## Local setup on this PC (nothing on C:)

Tools live under `D:\claude-temp\ingest\`. `lib.mjs` finds them there automatically and
points TEMP, TMP, PIP_CACHE_DIR, HF_HOME and XDG_CACHE_HOME for child processes at
`D:\claude-temp`. Set those in your own shell as well:

```powershell
$env:TEMP='D:\claude-temp\tmp'; $env:TMP=$env:TEMP; $env:PIP_CACHE_DIR='D:\claude-temp\pip-cache'; $env:npm_config_cache='D:\claude-temp\npm-cache'
D:\Python\python.exe -m venv D:\claude-temp\ingest\venv
D:\claude-temp\ingest\venv\Scripts\python -m pip install -U yt-dlp faster-whisper
```

Whisper uses faster-whisper `small` on CPU (int8). The model is cached in
`D:\claude-temp\ingest\hf`. VOD audio is downloaded to `D:\claude-temp\ingest\work` and
kept there, so a re-run doesn't download it again.

## Twitch live monitor and Whisper (local only)

These stay off CI. The live monitor has to keep running, and Whisper needs a CPU and
model download that the Actions runner doesn't have.

```bash
node scripts/ingest/twitch-live.mjs                     # channels from twitch/channels.json
node scripts/ingest/twitch-live.mjs inanobit heartlessedly
node scripts/ingest/twitch.mjs --whisper                # chat replays + Whisper transcripts
```

From the lab (`bb lab`), start the monitor alongside the bridge from the bridge's nREPL
(`localhost:1667`) or the Claude panel's REPL:

```clojure
(def kb-live (babashka.process/process ["node" "scripts/ingest/twitch-live.mjs"] {:dir "." :inherit true}))
;; stop it: (babashka.process/destroy-tree kb-live)
```

Or, in a second terminal: `bb -e '(babashka.process/shell "node scripts/ingest/twitch-live.mjs")'`.

## CI

`.github/workflows/ingest.yml` runs hourly at :43 and on demand. It runs speedrun,
reddit, youtube and discord (Discord only does something if the `DISCORD_BOT_TOKEN`
secret is set). It commits `data/kb/raw`, then pushes to `main` and `gh-pages`. Each run
makes at most `INGEST_YT_MAX=60` yt-dlp calls. YouTube often asks GitHub runners to
"Sign in to confirm you're not a bot". When that happens the YouTube step logs the error
and the local run fills the gap. Reddit returns 403 to anonymous requests from most
datacenter IPs, so add `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` secrets: create a
"script" app at https://www.reddit.com/prefs/apps.
