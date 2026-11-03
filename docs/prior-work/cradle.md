# Cradle

A "General Computer Control" framework: the agent sees only screenshots and acts only through keyboard and mouse, with no game API. Its modules are information gathering (VLM + OCR), self-reflection, task inference, skill curation (it writes and stores Python skills such as `turn`, `shoot`), action planning, and memory. It completed about 40-minute story missions in Red Dead Redemption 2, and also played Stardew Valley, Cities: Skylines and Dealer's Life 2, and ran software apps.

- Repo: https://github.com/BAAI-Agents/Cradle
- Paper: https://arxiv.org/abs/2403.03186. "Cradle: Empowering Foundation Agents Towards General Computer Control", ICML 2025 (PMLR 267, https://mlanthology.org/icml/2025/tan2025icml-cradle). Earlier at a NeurIPS 2024 workshop.
- Site: https://baai-agents.github.io/Cradle/
- License: MIT
- Maturity: about 2.6k stars, last push 2024-11-07. Not updated since, and set up for Windows + GPT-4o.

## Mapping onto our layers

| Layer | Cradle | Take for us |
|---|---|---|
| Sense | Screenshot -> VLM description + OCR + minimap reading | **Most relevant to Dragonwilds**, because the only way we can sense it is the screen. Use `look.mjs`-style capture of the game window, OCR of the timer/HUD, and VLM classification of zone or boss. |
| Know | Episodic memory plus a skill registry | As in Voyager. |
| Decide | Task inference -> skill selection -> action | Usable for OSRS. For Dragonwilds, only advice (we do not let an agent play a leaderboard run). |
| Show & Compete | Mission completion | - |
| Sangha | Modules are separate prompts, a pipeline rather than peers | Module split = sangha roles (Sense agent, Know agent, Decide agent). |
| Handover | None | - |
| Knowledge base | Skills as code docstrings | - |

## Integration steps
1. **Dragonwilds Sense via screen**: a Node or Python sidecar captures the Dragonwilds window at 2-4 Hz, crops the HUD regions, runs OCR, and posts `{source:"dw-screen", type:"zone"|"boss-hp"|"loading"}` to `/api/feed`. This gives auto-splitting and auto-reset detection without memory reading.
2. Use the VLM only on change (zone transitions) to keep cost down. Use cheap pixel or template matching for loading screens and the boss bar.
3. The Cradle reflection step ("did the last action succeed?") maps directly onto the OSRS driver's expected-outcome check.

## Risks
- VLM latency (seconds) is far too slow for real-time raid play. Use it only for observing, coaching and splitting.
- The speedrun.com rules for the Raid board and Jagex ToS: any automated input in Dragonwilds would invalidate runs. Keep Dragonwilds sense-only.
- The code is tied to the GPT-4o API of its time.
