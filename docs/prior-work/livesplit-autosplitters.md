# LiveSplit, its server, and autosplitters

LiveSplit is the standard PC split timer. Around it sit: the **internal server** (named pipe, TCP, or WebSocket) that lets other programs drive the timer; **autosplitters**, which split for you from game memory (ASL scripts, or WebAssembly modules on the Auto Splitting Runtime); **livesplit-core**, the Rust engine behind LiveSplit One; and **AutoSplit** (Toufool), which splits from screen image matching. Our Timer page already exports `.lss` (`js/lib/lss.js`) with WR, Nanobit and community sum of best as comparisons. These tools close the loop, so the timer runs while the game has focus and splits are not pressed by hand.

Checked 2026-11-03. Metadata comes from the GitHub REST API: stars and last push.

| Tool | URL | License | Maturity |
|---|---|---|---|
| LiveSplit (desktop, .NET, Windows) | https://github.com/LiveSplit/LiveSplit | MIT | 1.9k stars, pushed 2026-10-21. The de facto standard. |
| Internal LiveSplit Server (built in) | https://github.com/LiveSplit/LiveSplit#the-livesplit-server | MIT (part of LiveSplit) | Stable. The old component https://github.com/LiveSplit/LiveSplit.Server says it is deprecated and merged into LiveSplit. |
| LiveSplit.AutoSplitters (registry XML) | https://github.com/LiveSplit/LiveSplit.AutoSplitters | none declared | 188 stars, pushed 2026-11-03. Very active: about 1.3 MB of entries. No RuneScape/Dragonwilds entry (grep of `LiveSplit.AutoSplitters.xml`, 2026-11-03). |
| ScriptableAutoSplit (ASL host) | https://github.com/LiveSplit/LiveSplit.ScriptableAutoSplit | none declared | Pushed 2026-08-03 |
| asr (Rust crate for ASR autosplitters) | https://github.com/LiveSplit/asr | Apache-2.0 OR MIT | 13 stars, pushed 2026-10-11. Has an **`unreal` feature** (`src/game_engine/unreal`: GEngine / GWorld / FName pool via signature scan). |
| asl-help (C# helper for ASL, includes Unreal helpers) | https://github.com/ero-qt/asl-help (was just-ero/asl-help) | GPL-3.0 | Pushed 2026-07-08. Widely used in UE ASLs. |
| livesplit-core | https://github.com/LiveSplit/livesplit-core | Apache-2.0 OR MIT | 230 stars, pushed 2026-11-02. npm `livesplit-core` is stale (0.10.2, 2022). Build wasm from source. |
| LiveSplit One (web + desktop) | https://github.com/LiveSplit/LiveSplitOne, https://one.livesplit.org | MIT | 304 stars, pushed 2026-11-01. Can connect *to* a WebSocket server as a remote-controlled timer (`src/api/LiveSplitServer.ts`). |
| AutoSplit (image-matching autosplitter) | https://github.com/Toufool/AutoSplit | GPL-3.0 | 329 stars, pushed 2026-10-24. Windows 10/11 and Linux (X11). |
| LiveSplit.AutoSplitIntegration | https://github.com/Toufool/LiveSplit.AutoSplitIntegration | no LICENSE file | 3 stars, pushed 2026-07-20 |
| Example UE ASLs | https://raw.githubusercontent.com/LiterallyMetaphorical/Livesplit.Trepang2/main/Trepang2.asl, https://raw.githubusercontent.com/streetbackguy/Autosplitter-Projects/refs/heads/main/LiveSplit.FlyKnight.asl | - | Community patterns: sig-scan GWorld/GEngine/FNamePool |

## Key facts
- **Server protocol** (LiveSplit README): named pipe `\\.\pipe\LiveSplit` (always open), or TCP, or **WebSocket at `ws://<host>:16834/livesplit`**. TCP and WS are started by hand (or by the Startup Behavior setting). Commands: `starttimer`, `split`, `startorsplit`, `unsplit`, `skipsplit`, `reset`, `pause`/`resume`, `setgametime`, `setcomparison`, `getdelta`, `getcurrenttime`, `getsplitindex`, `getcurrenttimerphase`, `getbestpossibletime`, `getpredictedtime`, `getservertype` and more. Over WS, messages carry no trailing newline.
- **Autosplitter types** (AutoSplitters README): ASL script (recommended), WASM module on the sandboxed Auto Splitting Runtime (Rust has the best support), a .NET component, or a third-party app over the server.
- **AutoSplit (video)**: compares capture-region frames to split images by L2 norm (default), histogram or pHash. Filename flags: `(0.9)` threshold, `[10]` pause s, `#3500#` delay ms, `{d}` dummy, `{b}` below-threshold, `{p}` pause key, `@3@` loop, `^1^` method. Special images: `start_auto_splitter`, `reset`. Capture: Windows Graphics Capture (about 60 fps), BitBlt, Desktop Duplication, or a capture device (OBS virtual cam). It sends hotkeys, or talks to LiveSplit through the integration component.

## Can Dragonwilds be autosplit? Yes, in two ways
1. **Video (fastest to ship): AutoSplit.** Our `scripts/review/scan.py` already finds the "EXTRACTION POINT UNLOCKED" banner by normalised cross-correlation in the top band, and "GET OUT NOW!" plus the black cut. Splits 1-4 = banner, split 5 = cut to black (`TRIGGER` in `js/data/raid.js`). Feed AutoSplit the same templates (`scripts/review/make_templates.py`) as masked PNGs, with a `{b}` black-frame image for the end. Start = the loading icon disappearing. That needs a "loading icon" image with `{b}` (split when it *stops* matching). Accuracy is about 1 frame at 60 fps capture, which is enough for RTA. No memory reading, so no anti-cheat or EULA question.
2. **Memory (most precise, highest effort): ASR with `asr` `unreal` feature, or ASL + asl-help.** Dragonwilds is UE5. Find GWorld and the FName pool by signature, then read the current level name or the raid objective state. Needs reverse engineering with Cheat Engine and breaks on every patch (we track patches hourly). A WASM ASR also runs in LiveSplit One desktop. Ask the speedrun.com mods first, because some boards forbid memory tools or require approval.

## Mapping onto our layers

| Layer | What these give us | Take for us |
|---|---|---|
| Sense | AutoSplit frame matching. ASR/ASL memory reads. Server `getcurrenttime`/`getsplitindex`. | Reuse scan.py templates live. Poll LiveSplit over WS for authoritative time while the game has focus. |
| Know | `.lss` history (segment history, golds) | Already parsed by `lss.js`. Import after each session into `data/kb`. |
| Decide | Comparisons: PB, Best Segments, Balanced PB, custom | Push our `targetPace` (6:48) as a custom comparison and `setcomparison` from the app. |
| Show & Compete | LiveSplit layout, deltas | The Run navigator shows the delta from WS data instead of its own clock. |
| SMILE sangha | Server = shared bus for multiple agents | The bridge (`scripts/bridge.clj`) relays LiveSplit WS events onto the live feed, so Claude sees splits. |
| Handover manual<->auto | Hotkeys vs autosplitter | Manual split stays as the fallback. The autosplitter splits, and the human can `unsplit`/`skipsplit`. Log which source fired each split. |
| Knowledge base | AutoSplitters registry | Once stable, register a Dragonwilds autosplitter (XML PR) so the community benefits. |

## Integration steps
1. **WS bridge (1 day):** add `js/lib/livesplit-ws.js`. Connect to `ws://localhost:16834/livesplit` and poll `getcurrenttime`, `getsplitindex` and `getcurrenttimerphase` at 10 Hz. Mirror them into the Timer / Run navigator, with a toggle for "LiveSplit drives / app drives". Browsers can open `ws://localhost` from an http(s) page in Chrome/Edge. If mixed-content rules block it on the published https site, route it through the bridge at 127.0.0.1:5180.
2. **Push comparisons live:** after importing our `.lss`, call `setcomparison TexasPete` or `setcomparison Target 6:48` from the UI.
3. **AutoSplit profile:** export the banner, GET OUT and loading templates from `make_templates.py` at 1920x1080 as masked PNGs into `autosplit/dragonwilds/`. Use the naming `001_vines_(0.88)_[20].png` and so on, `{b}` for the end cut, plus a `reset` image (main menu). Document it in README. Validate offline: replay the TexasPete video into OBS virtual cam and compare against our measured splits (±0.1 s).
4. **Optional ASR:** prototype in `D:\claude-temp\prior\asr-dragonwilds` with `asr = { features = ["unreal","signature"] }`. Read the GWorld map name for raid start/end. Only pursue this if the mods allow it.

## Risks
- AutoSplit is GPL-3.0. Fine as a separate tool, but don't copy its code into the MIT-style app.
- The banner may change with UI scale, language or patches. scan.py already searches scales 0.8-1.15, and AutoSplit does not, so make one image per UI scale.
- Memory autosplitters break on every patch, and UE5 offsets shift. Rule acceptance is unknown.
- The WS server must be started by hand unless the Startup Behavior setting is used. The port may be in use.
