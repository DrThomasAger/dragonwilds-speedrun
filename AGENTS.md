# Agents working in this repository

This file is for every AI agent that works here, from any vendor (Claude, Gemini, Codex, Copilot, Cursor, local models). `CLAUDE.md` and `GEMINI.md` point here. Read it before reading or adding data.

## The real-time data interface (the live feed)

Live data goes in and out of the Raid Lab through one interface, the **bridge** (`scripts/bridge.clj`). It runs on Hanjo's PC with `bb lab` (or `npm run lab`) and listens only on `127.0.0.1:5180`. The public GitHub Pages site has no bridge.

### Reading

| Call | Returns |
|---|---|
| `GET http://127.0.0.1:5180/api/status` | `{bridge, claude, game, feed, tails, twitchLive, repl, gameReplPort}`. `tails` gives the number of files followed for each source. Call this first to see whether the bridge is up. |
| `GET http://127.0.0.1:5180/api/feed` | `{events: [...last 100], snapshot}` |
| `GET http://127.0.0.1:5180/api/events` | A server-sent event stream. The first message is `{type:"hello", events, snapshot, busy}`. After it come `{type:"feed", event}`, `{type:"game", snapshot}`, `{type:"reload", files}`, `{type:"claude", event}` and `{type:"ping"}`. |
| `live/feed.jsonl` | Every feed event ever, one JSON line each, append-only. Use it when the bridge isn't running, or to read history. |

Every event is `{at, source, type, text, ...}`, with `at` in epoch milliseconds.

### Sources that already flow in

| `source` | Where it comes from |
|---|---|
| `app` | The app's own events: splits, PBs, resets and practice results (`js/lib/bridge.js` posts them) |
| `osrs` | A snapshot polled from the RuneLite client nREPL (port 7889, or `LAB_GAME_REPL_PORT`), plus the files named in `LAB_OSRS_EVENTS` |
| `kb` | `data/kb/raw/ingest-log.jsonl`: each new item the ingesters find. Progress lines are skipped. |
| `twitch` | `data/kb/raw/twitch/live-*.jsonl`: runners' live chat. The bridge starts `scripts/ingest/twitch-live.mjs` itself; `LAB_TWITCH_LIVE=0` turns that off. |
| `log` | Whatever `LAB_GAME_FILE` names |

`LAB_OSRS_EVENTS` and `LAB_GAME_FILE` take globs, and several paths separated by `;`.

### Adding a source (use these ways, never a new channel)

There are two ways in, and both reach the Claude panel, the KB page's "Live from the lab" box and `live/feed.jsonl` within a second.

1. **Push.** Send `POST http://127.0.0.1:5180/api/feed` with a JSON body `{"source":"<name>","type":"<kind>","text":"<one readable line>", ...}`. Use this from a process that is already running.
2. **Append.** Write one JSON line per item to an append-only file and have the bridge follow it. Under `data/kb/raw/`, add a pattern to `tail-sources` in `scripts/bridge.clj`. Elsewhere, add its path to `LAB_OSRS_EVENTS` or `LAB_GAME_FILE`. A line can be `{kind|type, text|title|message, ...}`; any other JSON is shown as its first 400 characters. A line that isn't JSON is shown as written.

Files the bridge already follows are read from their end, so history is never replayed. A file that appears later is read from its start.

### The hourly ingesters (not real time)

`scripts/ingest/run-all.mjs` collects speedrun.com, YouTube, Reddit, Twitch VODs and Discord into `data/kb/raw/` (`.github/workflows/ingest.yml`, hourly at :43). The details are in `scripts/ingest/README.md`. Each new item it finds is a line in `ingest-log.jsonl`, so it also shows up in the live feed when the bridge is running.

## Rules that apply to every agent

- Never write to the C: drive on Hanjo's PC. Temp files and caches go under `D:\claude-temp`.
- Nothing aimed at the OSRS client may run heavy work on its client thread. Read what the OSRS aids already write to files (`tick_monitor\live_<name>\...`) and leave the client alone. The OSRS project's own `CLAUDE.md` holds the full rules.
- Private data stays in the private vault (see `CLAUDE.md`). Never copy it into this public repo.
