# MineDojo

Minecraft simulator suite (thousands of programmatic and creative tasks) plus an internet-scale knowledge base: about 730k YouTube videos with transcripts, about 7k Minecraft Wiki pages, and about 340k Reddit posts. Its MineCLIP model learns a video-text reward from the YouTube data and uses it as a dense reward for RL agents.

- Repo: https://github.com/MineDojo/MineDojo
- Paper: https://arxiv.org/abs/2206.08853 (NeurIPS 2022 Datasets & Benchmarks, Outstanding Paper). Site: https://minedojo.org
- License: MIT (code). Dataset terms are separate.
- Maturity: about 2.3k stars, last push 2024-03-18. Dormant, and Java/Gradle setup is fragile.

## Mapping onto our layers

| Layer | MineDojo | Take for us |
|---|---|---|
| Sense | Pixels plus voxels, inventory, GPS | Not needed. |
| Know | **YouTube + wiki + Reddit corpus** | This is what our `scripts/ingest/` already does (youtube, reddit, discord, twitch, whisper). MineDojo is the precedent and gives the data-schema ideas (timestamped transcript chunks linked to a wiki entity). |
| Decide | RL policies with MineCLIP reward | Video-text alignment could auto-locate splits/skips in run videos. |
| Show & Compete | Task suite with success metrics | - |
| Sangha / Handover | None | - |
| Knowledge base | Wiki + Reddit + video, cross-linked | Copy the cross-link: every Mechanics wiki entry -> transcript timestamps -> clips. |

## Integration steps
1. In `scripts/build-kb.mjs`, store transcript chunks as `{video, t0, t1, text, entities[]}` and match entities against Mechanics wiki IDs. The Reel Studio can then build "every clip mentioning X".
2. Optional, heavy: a CLIP-style matcher (an open CLIP model in Python, run offline) to find split frames such as the boss-door frame in runs that have no split marks. Write the results into `data/kb` and use them as Monte-Carlo priors.

## Risks
- Large and unmaintained. Take only the ideas and do not depend on it.
- Scraping YouTube/Reddit at scale: follow platform ToS and do not redistribute the raw corpora.
