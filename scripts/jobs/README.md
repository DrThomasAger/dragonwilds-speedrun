# Scheduled jobs (Windows Task Scheduler)

All jobs run as the current user (no admin), hidden (no windows pop up over games), at normal
priority, and keep every temp file, cache and log on D: (`D:\claude-temp\...`).
Each new task runs `wscript.exe scripts\jobs\hidden.vbs scripts\jobs\<job>.mjs`.

| Task | Schedule | What it does | Log |
|---|---|---|---|
| RaidLab Hourly | every hour (:28), 2 h limit | `hourly.mjs`: waits for network after wake, patch notes, sources, all ingest, reviews, analysis, KB (each step has its own timeout, output streamed into the log); commit + push data/ docs/ (main + gh-pages) | `D:\claude-temp\logs\jobs-<date>.log` |
| RaidLab Logon | at logon | `logon.cmd`: starts `bb lab` bridge and `scripts\ingest\twitch-live.mjs` | `bridge.log`, `twitch-live.log` |
| RaidLab Transcripts | every 2 h (:15) | `transcripts.mjs`: `scripts/ingest/youtube.mjs --no-comments` (transcripts only) | `transcripts-<date>.log` |
| RaidLab Daily Review | daily 04:30 | `daily-review.mjs`: full review backlog (`scripts/review/run.mjs`), analysis, KB rebuild, `npx playwright test` (summary in log), commit + push data/ docs/ | `daily-review-<date>.log` |
| SMILE Arena Build | hourly at :35 | `smile-arena-build.mjs`: in `D:\labyrinth\Github\smile-arena` git pull --rebase, `npm run build:site`, commit + push if changed (the repo's Action publishes the site); retries unpushed commits | `smile-arena-build-<date>.log` |
| Sangha Bridge Watchdog | every 10 min | `watchdog.mjs`: if nothing on 127.0.0.1:5180 starts `bb lab` (here); if nothing on 5555 starts `python server.py` in `SmilePrompt\Composer\osrs\gui` | `watchdog-<date>.log`, `bridge.log`, `osrs-gui.log` |
| Sangha Health | every 30 min | `health.mjs`: C:/D: free space, every task's last result, ports 5180/5555 | `health.log` (one line per run), `health.json` (latest snapshot) |
| RuneLite Capture | at logon + hourly (:50) | `runelite-capture.mjs` -> `capture-runelite.ps1`: PrintWindow capture of a "RuneLite - *" window to `D:\claude-temp\demo\runelite-latest.png` (no clipboard, never moves/focuses windows, skips if minimised) | `runelite-capture-<date>.log` |

All logs are in `D:\claude-temp\logs`.

## Pause / resume / run now

```
schtasks /Change /TN "RaidLab Daily Review" /DISABLE
schtasks /Change /TN "RaidLab Daily Review" /ENABLE
schtasks /Run /TN "RaidLab Daily Review"
schtasks /Query /TN "RaidLab Daily Review" /V /FO LIST
```

## Re-create / update the new tasks

`powershell -ExecutionPolicy Bypass -File scripts\jobs\register-tasks.ps1` (overwrites tasks of the same
name, never deletes anything).

## Files

- `lib.mjs` shared helpers: D: environment (TEMP, TMP, npm_config_cache, PIP_CACHE_DIR, HF_HOME,
  XDG_CACHE_HOME, PLAYWRIGHT_BROWSERS_PATH), per-job logger, hidden child processes, port check, git publish.
- `hidden.vbs` runs a job script with no window and passes back its exit code.

## Notes

- Hourly, Transcripts and Daily Review share one lock (`D:\claude-temp\locks\raidlab-data.lock`), so they never run at once; a job waits for the other (30-90 min) and otherwise skips that run. A lock left by a dead process is taken over.

- Tasks use priority 6 (normal). With the Task Scheduler default (7, below normal) jobs never got
  started while the PC sat at 100% CPU, so they hung forever.
- "Sangha Debug Probe" is a disabled leftover test task from setup; it can be removed with
  `schtasks /Delete /TN "Sangha Debug Probe"` if you want.
