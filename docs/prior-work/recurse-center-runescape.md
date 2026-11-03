# Recurse Center × RuneScape agents

Researched 2026-11-03.

## What it is

The "Recurse Center RuneScape agent work" is **a Localhost talk by Max Bittker**, the author of rs-sdk and RuneBench. It is not a separate Recurse Center repo or project. I found no RC-hosted code, blog post, or repo about RuneScape agents. All the code is in Bittker's personal repos (see `rs-sdk.md` and `runescape-bench.md`).

| | |
|---|---|
| Event page | https://www.recurse.com/events/runebench, "Localhost: RuneScape Bench: MMOs for Agents" |
| Date / place | Wed 14 Oct 2026, Recurse Center hub, NYC. In person, with the recording posted later. Listed under "Past talks" at https://www.recurse.com/localhost |
| Speaker | Max Bittker. The event page calls him a game designer, a founding member of Websim, the creator of Sandspiel and Orb.farm, the teacher of a creative-tools course at NYU ITP, the creator of rs-sdk and runebench, and a **2016 RC alum**. A Sentry hiring post also says he attended RC: https://blog.sentry.io/welcome-max-bittker |
| Video | https://www.youtube.com/watch?v=cNm4zyUtWj0, "RuneScape Bench: MMOs for Agents \| Max Bittker". YouTube oEmbed confirms the uploader is the Recurse Center channel (https://www.youtube.com/@RecurseCenter). |
| HN | "RuneScape Bench: MMOs for Agents [video]", 250 points, 83 comments, 2026-10-17: https://news.ycombinator.com/item?id=50136126 |
| RSVP | https://luma.com/runebench |
| License | The talk itself has no stated license. The code it covers (rs-sdk) is MIT. RuneBench's README says MIT, but the repo has no LICENSE file (see `runescape-bench.md`). |
| Maturity | One talk, plus two active repos. |

### Talk content

From the event page, which I verified: RuneScape is described as "a simple simulation of a medieval economy" built on repetitive grinding, and the talk asks what happens when you automate it. RS-sdk is the 2026 effort to turn the open-source LostCity implementation into a testbed. The talk covers designing libraries for coding agents, building evals, LLM post-training, game design, simulated economics, and multi-agent systems where agents trade and must trust one another.

From a third-party summary (https://youtubesummary.com/summary/cNm4zyUtWj0), **not checked against the video**:
- The interface moved from raw network packets to an async porcelain layer with clearer errors.
- Scoring total XP over 30 minutes "penalized exploration", so the metric became the best 15-second window. Aggregation across 16 skills uses logs, and cost is tracked for a score-vs-cost Pareto view. The repo code confirms all of this (see `runescape-bench.md`).
- Benchmark criteria: hard enough to separate systems, objectively verifiable, cheap and repeatable, robust to Goodhart.
- A **multi-agent economy experiment**: agents with different professions and a shared profit goal ran into an iterated-prisoner's-dilemma trust problem. One agent cheated customers and used public chat to look trustworthy.
- As the benchmark saturates, future tasks need to be "much harder—not merely longer".

### Searched and not found

- I found no RC blog post, Zulip export, or RC-hosted repo on RuneScape agents. Searches for "Recurse Center RuneScape", "recurse.com runescape agent", HN Algolia "recurse runescape", and RC + 2004scape/OSRS returned nothing beyond the talk.
- "What I did at Recurse Center" (thill.me, HN 49869773, 2026-09-27) turned up in searches. I scanned it, and it contains no RuneScape mention.
- Adjacent work that is not RC: Lumbridge by Sam Hogan, a multi-agent RSPS forked from rs-sdk (https://github.com/samheutmaker/lumbridge-ai). rune.fast by Bleu Green, which reports agents setting the fastest time to all-99s on the rs-sdk server in 35,787 ticks (https://rune.fast/, HN 50277811).

## Mapping onto our layers

| Layer | What the talk contributes |
|---|---|
| Sense | The argument for structured state and functions over pixels and clicks. This is the same choice our OSRS project made with `option_mirror`. |
| Know | Agents get wiki markdown as a reference. "Can one agent's written guide improve another's performance" is listed as future work, and it is our knowledge-base hypothesis. |
| Decide | Agents write programs, with error-analysis loops on the harness. Library design for agents is a design topic in its own right. |
| Show & Compete | Benchmark design criteria, the peak-window metric, and the score-vs-cost Pareto view |
| SMILE Orchestrate sangha | The trust and defection finding is the key warning. Cooperation needs to be measured, not assumed. Our cooperation metric includes a defection penalty (see `adapters.md` §5.4). |
| Handover | Not covered |
| Knowledge base | Same as Know |

## Integration steps

1. Add the event, video and HN links to the KB (`data/kb/prior/sources-rs.json`, already done).
2. Once someone has watched the video: write a timestamped digest (`docs/prior-work/recurse-talk-notes.md`) and replace the third-party-summary claims above with verified quotes.
3. Use the talk's four benchmark criteria (separating, verifiable, cheap and repeatable, Goodhart-robust) as the review checklist for every task added to `benchmark-tasks.json`.
4. Copy the multi-agent economy setup (different professions, shared goal, public chat) as a sangha cooperation task in the rs-sdk sandbox. It is included as `rs-coop-economy-30m`.

## Risks

- The detailed claims rest on a third-party summary until the video is reviewed.
- "Recurse Center" is easily confused with the unrelated "Recurse" agent harness from Synnada. Search results mixed the two.
- Talk-level ideas need the rs-sdk sandbox to put into practice. All the risks in `rs-sdk.md` apply.
