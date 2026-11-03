# Voyager

GPT-4 agent for lifelong learning in Minecraft. It has three parts: (1) an automatic curriculum that proposes the next task, (2) a skill library of verified JS programs, indexed by embedding of their description and composed into new skills, and (3) iterative prompting that feeds back environment feedback, execution errors and a self-verification critic. It got 3.3x more unique items than the baselines and transferred its skills to a fresh world.

- Repo: https://github.com/MineDojo/Voyager
- Paper: https://arxiv.org/abs/2305.16291 (arXiv lists no venue. Widely cited as TMLR 2024, which I have not verified here). Site: https://voyager.minedojo.org
- License: MIT
- Maturity: about 7.3k stars, last push 2024-04-03. Finished research code, not maintained, pinned to old OpenAI APIs.

## Mapping onto our layers

| Layer | Voyager | Take for us |
|---|---|---|
| Sense | Mineflayer state as text plus chat log and errors | Use the same text snapshot. Errors from `/api/eval` must go back to the LLM verbatim. |
| Know | **Skill library**: code plus a description, retrieved by embedding | Store OSRS hand routines (bank `kit`, `make_room`, A* walks) as named Clojure skills in a `skills/` dir with docstrings, and retrieve them by description. |
| Decide | Curriculum proposer plus code writer | For OSRS: the proposer picks the next quest step. For Dragonwilds: "practice the weakest skip" is already a curriculum (Practice page). Formalise it. |
| Show & Compete | Unique items / tech-tree milestones | Count milestones: skills learned, skips verified. |
| Sangha | None | Split the critic out as its own agent (the second-window "eyes" instance in OSRS already does this). |
| Handover | None | - |
| Knowledge base | Skill library is the KB of *how* | Pair it with our KB of *what* (`data/kb`). |

## Integration steps
1. `skills/*.clj` in the OSRS repo: each skill is a `defn` with a docstring, a precondition, and an expected outcome check (this matches Hanjo's rule 4, "every step has an expected outcome").
2. Add a skill only after it has been seen working: log the run ID and the feed line that proved it. This is exactly the existing INHERITANCE_hand.md rule, now machine-readable (`skills/index.edn`).
3. Self-verification: after each skill, the critic reads the snapshot diff and posts `{:type "verify" :ok bool :why ...}` to `/api/feed`.
4. Retrieval: start with keyword or tag match over docstrings. Add embeddings only if the library grows past about 100 skills.

## Risks
- Voyager's skills are code that runs against a full bot API. In Dragonwilds we cannot run code in the game, so the "skill" there is a human technique, stored as a Route entry plus a clip.
- A skill library goes stale after patches. Tag every skill with the game version (we already track patch notes).
