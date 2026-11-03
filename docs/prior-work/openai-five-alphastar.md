# OpenAI Five and AlphaStar: what transfers

Both are large-scale deep RL systems, not LLM agents. What carries over to us is their training and evaluation methods, not their models.

## OpenAI Five (Dota 2)
- Paper: "Dota 2 with Large Scale Deep Reinforcement Learning", https://arxiv.org/abs/1912.06680. Blog: https://openai.com/research/openai-five-defeats-dota-2-world-champions
- Code: none released (paper and blog only). License: n/a.
- Maturity: finished in 2019. Beat world champions OG 2-0 (April 2019). Arena: 7,257 public games, 99.4% win rate.
- What transfers:
  - **Reward shaping + "team spirit"**: a weight that blends each agent's own reward with the team's average, annealed from 0 to 1 over training. For a sangha: score each agent partly on the shared goal (the raid time) and not only its own subtask.
  - **Surgery**: continuing training across environment/game patches without restarting. For us: patch-aware KB and model updates. When a patch changes a skip, update only the affected segment priors in `model.mjs` instead of refitting everything.
  - **Human-AI co-op ("Arena" mixed teams)**: humans played *with* bots. A direct precedent for handover manual<->auto.
  - **Eval vs humans**: a large public arena gives a statistically solid win rate. Single show matches do not.

## AlphaStar (StarCraft II)
- Paper: Vinyals et al., "Grandmaster level in StarCraft II using multi-agent reinforcement learning", Nature 575, 350-354 (2019), https://www.nature.com/articles/s41586-019-1724-z. Blog: https://deepmind.google/discover/blog/alphastar-grandmaster-level-in-starcraft-ii-using-multi-agent-reinforcement-learning/
- Code: environment https://github.com/google-deepmind/pysc2 (Apache-2.0, about 8.3k stars, last push 2024-07). Training and eval library https://github.com/google-deepmind/alphastar (Apache-2.0, 605 stars, last push 2022-09). Unmaintained.
- What transfers:
  - **League training**: main agents plus *main exploiters* (beat the current main) plus *league exploiters* (find holes in the whole league), with prioritised fictitious self-play. For us: a sangha role, the **exploiter agent**, whose only job is to find where the current route or plan fails (e.g. sample worst-case Monte-Carlo runs, stress-test reset thresholds).
  - **Imitation first, then RL**: supervised on human replays, then improved. For us: learn from community runs (`data/kb/runpath.json`, YouTube splits) before self-optimising.
  - **Statistic conditioning (z)**: the policy is conditioned on a target build order. For us: condition coaching on a chosen route variant (`--route` in `simulate.mjs`).
  - **Fair-play limits**: APM/camera limits so the comparison with humans is fair. For us: when an agent plays OSRS, publish its action-rate limits.
  - **Eval vs humans**: anonymous ranked play on Battle.net, Grandmaster, above 99.8% of ranked players. The gold standard for this is a blind, ranked, public evaluation.

## Mapping onto our layers

| Layer | OpenAI Five / AlphaStar | Take for us |
|---|---|---|
| Sense | Structured API observations (no pixels in Five); camera interface in AlphaStar | Structured text from REPL beats pixels when it is available. |
| Know | Learned from replays (AlphaStar) | Community runs -> segment priors (already in `model.mjs`). |
| Decide | Policy nets; LSTM | Not transferable. Our Decide is LLM + MC model. |
| Show & Compete | Public arena, Grandmaster ladder | speedrun.com board is our ladder. Track the lab's effect as PB deltas over many attempts, not single runs. |
| Sangha | Team spirit (Five); League roles (AlphaStar) | Roles: runner-coach, exploiter, historian (KB), scout (source tracker). Blend shared and own reward. |
| Handover | Five co-op with humans | Log handovers. Measure human+agent vs human alone. |
| Knowledge base | - | - |

## Integration steps
1. Add an **exploiter** mode to `scripts/analysis/simulate.mjs`: search parameter space (skip p, loss, fatal) for the smallest change that flips "beat 6:50" probability. Output it as "weakest assumption" to the KB and HQ page.
2. Reward blend for multi-agent tasks: `score_i = (1-τ)·own_i + τ·team`. Log τ with results.
3. Patch "surgery": when `fetch-patchnotes.mjs` flags a raid change, mark affected segments `stale` and widen their priors (Bayesian shrinkage already exists) instead of discarding data.
4. Human eval: keep A/B logs, sessions with the coach on vs. off, and compare Practice consistency and PB slope.

## Risks
- Compute scale is not comparable. Do not copy their RL; copy the protocols.
- Small n: one runner's attempts give noisy A/B results. Use Bayesian estimates and report intervals.
