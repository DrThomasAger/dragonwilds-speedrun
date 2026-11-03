# Generative Agents (Park et al., Smallville)

25 LLM agents live in a sandbox town. Its architecture: (1) a **memory stream**, a log of natural-language observations; (2) **retrieval** scored by recency x importance x relevance; (3) **reflection**, which periodically synthesises memories into higher-level insights stored back in the stream; (4) **planning**, with day plans broken down recursively into actions and re-planned when something happens. The emergent behaviour it showed was a Valentine's party organised from one seed idea.

- Repo: https://github.com/joonspk-research/generative_agents
- Paper: https://arxiv.org/abs/2304.03442 (UIST 2023)
- License: Apache-2.0
- Maturity: about 22.3k stars, last push 2024-08-05. Canonical reference, but the code is a research artifact (old OpenAI APIs, Django front end).

## Mapping onto our layers

| Layer | Generative Agents | Take for us |
|---|---|---|
| Sense | Perceive nearby objects/agents as text events | `/api/feed` events are our perception stream already. |
| Know | **Memory stream + recency/importance/relevance retrieval + reflection** | Use this for the bridge's feed: `live/feed.jsonl` is the stream, and we add an importance score per event (PB = high, split = low) and retrieval for the Claude context block. |
| Decide | Hierarchical plan -> re-plan on event | For OSRS: quest plan -> step -> action, re-planned when a dialogue outcome is wrong (Hanjo rule 4). |
| Show & Compete | Replay viewer of the town | Model for a "run replay" view in the PWA driven by the feed. |
| Sangha | Agents talk, share info, coordinate events | Information spreads between agents through conversation. Our sangha can share via the feed instead of P2P. |
| Handover | Human "inner voice" injects a belief into an agent | Clean handover primitive: the human posts `{type:"inner-voice"}` to the feed and the agent treats it as top-importance memory. |
| Knowledge base | Reflections are a self-built KB | Nightly reflection job: summarise the day's feed into `data/kb/agents/memory.json`. |

## Integration steps
1. In `bridge.clj` `add-event!`, attach `:importance` (a rule table: pb 9, reset 6, split 3, game snapshot 1) and keep the full stream in `feed.jsonl` (already done).
2. Change `context-block` so it selects the top-K events by `recency*importance*relevance` (relevance = keyword overlap with the prompt) instead of the last N.
3. Reflection: `bb reflect` asks Claude to answer "what are the 3 most important things learned today?" over the stream and appends the answers as `type: reflection` events plus KB entries.
4. Handover: an "inner voice" box in the ✦ panel that posts `type: inner-voice`.

## Risks
- Cost: reflection plus retrieval over a long stream makes many LLM calls. Batch them nightly.
- Reflections can turn wrong guesses into confident "facts". Store a source event ID with every reflection and let the KB check them (the same failure Claude Plays Pokémon hit).
