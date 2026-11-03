# splits.io, therun.gg, speedrun.com API

These are three external data services for runs. **splits.io** hosted full split files and ran races, and is now shut down. **therun.gg** collects full LiveSplit histories plus live runs. **speedrun.com** is the authoritative leaderboard that our HQ page already reads.

Checked 2026-11-03.

| Service | URL | License | Maturity / status |
|---|---|---|---|
| splits.io | https://splits.io, code https://github.com/glacials/splits-io | AGPL-3.0 (code) | **Shut down.** The site's meta description reads "Splits.io has shut down." The repo is archived (last push 2025-04-06). `/api/v4/...` returns 404. Useful only as a reference design: its run-analysis ideas and its schema of "attempt history" exchange via `.lss`. |
| therun.gg | https://therun.gg, live https://therun.gg/live | Frontend MIT (https://github.com/therungg/therun-frontend, pushed 2026-10-27). LiveSplit component MIT (https://github.com/therungg/LiveSplit.TheRun, bundled with LiveSplit since 2024-03-22). | Active. **No published API docs.** An undocumented JSON endpoint `https://api.therun.gg/live` (also `/api/live`) returns 40 current live runs with fields `user, game, category, startedAt, currentTime, currentSplitIndex, currentSplitName, delta, currentComparison, currentPrediction, bestPossible, pb, sob, splits[], runPercentage, hasReset`. Website pages sit behind Cloudflare (403 to curl). No Dragonwilds runs were live at check time. |
| speedrun.com REST API v1 | https://www.speedrun.com/api/v1, docs https://github.com/speedruncomorg/api | Docs repo has no license. **Content is CC BY-NC 4.0** (README). | Stable and versioned ("we will not change existing fields"). Read-only anonymous. **100 req/min per IP.** `access-control-allow-origin: *`, so it can be called straight from the PWA (we do: `SRC` ids in `js/data/raid.js`, game `2689lo91`, category `xd19vy4k`). Use `embed=` and `max=200` to cut calls. |

## What therun.gg would give us
- On every reset the component uploads the whole `.lss`, and on every split it pushes live state. The site then computes per-game stats: run distributions, golds, "chance of PB", reset rates.
- For Dragonwilds this only works once runners use LiveSplit with the component. TexasPete and Nanobit already run LiveSplit with the community split file (raid.js notes), so asking them to enable therun.gg would give us **real segment distributions and reset points**. Our Monte-Carlo model (`scripts/analysis/model.mjs`) currently has to estimate these.

## Mapping onto our layers

| Layer | splits.io | therun.gg | speedrun.com |
|---|---|---|---|
| Sense | - | `api.therun.gg/live`: live split index and delta of any runner | `/runs?status=new` for pending runs (already in the hourly tracker) |
| Know | Archive only | Full attempt histories → segment distributions for the MC model | Verified times, videos, version variable |
| Decide | - | Real reset-point data to check `reset-thresholds.csv` | WR = the goal |
| Show & Compete | - | "Live now" strip on HQ: anyone running Dragonwilds Raid | Leaderboard (HQ) |
| SMILE sangha | - | Live feed for the bridge (Claude sees a rival mid-run) | Source-tracker agent |
| Handover | - | - | - |
| Knowledge base | Design ideas | Per-runner `.lss` (with permission) into `data/kb` | Canonical record list |

## Integration steps
1. **therun.gg live strip:** poll `https://api.therun.gg/live` every 60 s from the bridge (not the PWA, because CORS is unverified). Filter `game` containing "Dragonwilds" and push into the live feed and HQ. Treat it as best-effort, since it is undocumented.
2. **Own uploads:** enable the therun.gg component in our own LiveSplit layout. Our runs then land on the site, and we can download our own `.lss` back via `lss.js` import.
3. **Model calibration:** with runners' consent, fetch their public therun.gg run pages manually or export `.lss`. Fit segment distributions and replace the assumed spreads in `model.mjs`. Record provenance in `data/kb`.
4. **speedrun.com:** keep the v1 calls. Add a `User-Agent: dragonwilds-raid-lab/x` header from the bridge or Action (browsers can't set it). Respect 100/min. Attribute CC BY-NC content on HQ.

## Risks
- therun.gg has no public API contract. Endpoints may change or be blocked by Cloudflare. Upload keys are secret ("anyone with this key can upload runs on your behalf").
- splits.io data is gone. Don't build on it.
- speedrun.com content is non-commercial (CC BY-NC 4.0). Fine for this lab, but not for a paid product.
