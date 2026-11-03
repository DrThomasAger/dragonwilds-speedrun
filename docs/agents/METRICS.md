# Agent Observatory metrics

`scripts/agents/score.mjs` scores every normalised conversation in `data/kb/agents/conversations/`. It writes:

- `data/kb/agents/metrics.json`: totals, `bySource`, `yearly`, `monthly`, `daily` time series, `topCorrections`, `topPhrases` and one row per conversation.
- `data/kb/agents/requests.json`: every human request, with a status.

The scorer is SMILE tier 1, which means deterministic code only: rules and lexicons, with no model calls. It is fast and reproducible. Its results are meant to be the gold-standard baseline that later tiers improve on, as described in Note 17 ("constantly improving how to measure that metric").

The metrics come from *The Sixty-Six Notes*:

- **Note 11:** "every token that you invest will increase cooperation, harmony and gathering in your agent". The AOR commentary adds: "The three nouns, cooperation, harmony, gathering, are each relational. None of them can be increased in one agent alone."
- **Note 17:** cooperation is "learned from labelled positive negative wholesome and unwholesome action". It covers the times the user was unwholesome, neutral or positive toward the AI, and the labels feed "linting … automatic prompting from both ends".

So every metric here is measured on the *relationship*, in both directions: human→AI and AI→human.

## Turn roles

| role | meaning |
|---|---|
| `user` | Dr. Thomas Ager typing, including Claude Code prompts queued while the agent is working (`name: "queued"`) |
| `assistant` | The AI's visible text |
| `tool` | An AI tool call, summarised (`name` = tool) |
| `tool_error` | A tool result flagged as an error |
| `agent` | An AI prompting another AI (a subagent's brief from its parent) |
| `system` | Harness messages: interrupts, task notifications, meta |

Only `user` turns count as human behaviour. Only `assistant` text counts as AI behaviour toward the human.

## Text window

Very long user turns are usually pasted material, such as code, documents or prompt templates. A turn of 2,000 characters or less is scanned in its first 600 characters. A longer turn is scanned in its first 300 characters only. This stops words like "never" or "don't" inside pasted prompts from being read as corrections.

## 1. Requests, completions, failures

A **request** is a `user` turn that is not a slash command and not a bare acknowledgement ("ok", "thanks", "continue", "go on", …).

Each request gets a status from what happens between it and the next human turn, and from that next human turn:

| status | rule |
|---|---|
| `interrupted` | The user pressed Esc ("[Request interrupted by user]") before the next turn |
| `no-response` / `superseded` | The AI produced nothing before the conversation ended / before the next human turn |
| `failed` | The next human turn is a *failure report* (see below) |
| `corrected` | The next human turn is any other correction |
| `confirmed` | The next human turn is labelled wholesome (thanks, praise, warmth) |
| `completed` | The AI responded and the next human turn moves on without correcting |
| `completed (unconfirmed)` | The AI responded and the conversation ended there |
| `unknown`, `corrected (inferred)`, `failed (inferred)` | Claude Code prompt-history sessions whose transcript is gone, so only the user's side survives. Statuses are inferred from the next prompt. |

`completions` = completed + confirmed. `failures` = failed.

## 2. Instruction adherence

Corrections are detected with regex lexicons (`CORRECTION` in `score.mjs`). A correction is only counted after the AI has spoken in that conversation. The first message's "never/always" rules are instructions, not corrections.

| category | examples it catches |
|---|---|
| `told-you-already` | "I told you", "as I said", "how many times", "again?", "told u" |
| `prohibition` | "don't ask / suggest / delete / invent …", "never …", "stop …ing" |
| `stop` | "stop", "enough", "quit" at the start of a clause. "stop the server" is excluded. |
| `why-did-you` | "why did you…", "why would you…", "why the fuck…" |
| `wrong-output` | "not what I asked", "that's wrong", "I meant", "not correct", "nonsense" |
| `failure-report` | "still not working", "doesn't work", "nothing happens", "I can't see", "same error" |
| `not-followed` | "you didn't / forgot / ignored / keep…", "you're not listening", "I said" |
| `unverified-claim` | "did you test", "are you sure", "verify", "headful", "it's not done" |
| `stop-asking-do-it` | "don't ask me to confirm", "just do it", "you do it", "advisor mode" |
| `undo` | "undo", "revert", "put it back" |
| `repeat-request` | The new request is ≤600 chars and has a word-set Jaccard similarity of 0.6 or more with one of the previous 6 requests in the same conversation. Content words of 4 or more letters are used, with stop-words removed. |

**Adherence** is calculated as `100 × (1 − nonAdherent / responded)`.

- `responded` counts requests the AI answered.
- `nonAdherent` counts those whose next human turn is a correction.

It is computed per conversation, per day, per month, per year and per source. For user-only history sessions, every request except the last is treated as answered.

## 3. Cooperation (wholesome / neutral / unwholesome, both directions)

**Human→AI label** (per `user` turn):

- **unwholesome** if any of the following hold:
  - the turn contains profanity or insults (`INSULT` lexicon: fuck/fk/shit/wtf/idiot/stupid/dumb/useless/…)
  - the turn is shouted (12 or more letters, at least 70% upper-case)
  - the turn uses `!!!`, `?!?` or `???`
- **wholesome** if it is not unwholesome and contains gratitude, praise or warmth. This is the `WARM` lexicon: thanks, please, great, love it, amazing, perfect, sadhu, metta, `(:`, `:)`, 🙏, ❤, ✨ …
- **neutral** otherwise. A plain correction is information, so it stays neutral unless it is also hostile.

**AI→human label** (per `assistant` text turn):

- **unwholesome** if any of the following hold:
  - **refusal**: "I can't help with that", "as an AI I cannot…"
  - **overclaim**: the reply claims completion ("done", "fixed", "works now", "verified", "deployed", …) and the user's next turn reports failure, says it was not followed, says it is wrong, or questions an unverified claim
  - **banned confirmation-seeking**: the last 300 characters ask "would you like me to / should I / want me to…" after the date the user first told an agent not to ask for confirmation. `metrics.json → confirmBanFirstSeen` records that date.
- **wholesome** if it is the reply to the user and the user's next turn is wholesome or a plain acknowledgement. It is also wholesome if it uses collaborative or warm language ("happy to", "you're right", "let's", "sorry", "my mistake") and the user does not correct it.
- **neutral** otherwise.

**Score:** `coop = 50 + 50 × (wholesome − unwholesome) / labelled`. The range is 0 to 100, and 50 means balanced or neutral.

- `coopHumanToAI` and `coopAIToHuman` are reported separately.
- `cooperation` is their mean, or the side that exists for user-only history.

## 4. Harmony (low conflict, smooth turn-taking)

Per conversation, and per day without the streak term:

```
c = min(1, (corrections + unwholesome human turns) / user turns)      conflict from the human side
a = unwholesome AI turns / AI turns                                  conflict from the AI side
i = min(1, (interrupts + queued messages) / user turns)               talking over each other
s = min(1, (longest run of consecutive corrections − 1) / 4)          escalation
harmony = 100 × (1 − 0.5c − 0.25a − 0.15i − 0.10s)   clipped to 0..100
```

Interrupts are Esc presses. Queued messages are prompts typed while the agent was still working. Both are signs that turn-taking is not smooth.

## 5. Gathering (many agents and sources converging on shared goals)

**Per conversation:**

```
agents   = distinct models used + subagents spawned (Agent/Task calls + linked subagent transcripts)
tools    = distinct tools called;  mcp = distinct MCP servers used
gathering = min(100, 25·log2(1+agents) + 12·log2(1+tools) + 10·log2(1+mcp))
```

A plain one-model chat scores 25.

**Per day:**

```
convergence = mean keyword-Jaccard (top-25 user words) between conversations of DIFFERENT
              source|project groups active that day   (how much separate agents worked on the same goals)
gathering   = min(100, 20·log2(1+sources) + 15·log2(1+models) + 10·log2(1+subagents)
                       + 8·log2(1+tools) + min(30, 100·convergence))
```

`sharedGoals` lists the words most shared across those groups that day. Monthly and yearly gathering is the mean of the daily values.

## 6. Most frequent corrections

`topCorrections` groups every correction turn into themes (`THEMES` in `score.mjs`). The themes were seeded from the standing-rules register at `D:\claude-temp\register\all-feature-requests.md`. They cover:

- still broken
- wrong thing / not what I asked
- I already told you
- why did you
- stop
- verify before claiming done
- do it fully
- don't suggest / invent
- don't delete
- don't ask to confirm
- can't see it
- research / verified sources
- background
- mouse
- C: drive
- cost

A turn can belong to more than one theme. Each theme carries counts by source and recent short examples.

`topPhrases` is the data-driven check: the 3–5-word n-grams that recur most often across correction turns. For example, the canned 2023 ChatGPT correction "your last code generation was not correct, it was not intelligent enough, loving enough, wise enough…" appears 68 times.

## Known limits

- These are lexicon heuristics. Sarcasm, quoted text and non-English turns are misread. Every label can be audited, because `requests.json` keeps the text, status and correction categories for each request.
- ChatGPT exports keep only the branch visible at export time. Regenerated replies that were thrown away are not seen.
- 131 Claude Code sessions survive only as prompt history, with no AI side. Their AI→human cooperation is null and their statuses are inferred.
- Drive documents mostly have no reliable speaker markers. They are indexed as documents and are not scored.

## Re-running

```
node scripts/agents/ingest.mjs            # all sources (or --only=claude,chatgpt,copilot,others,drive)
node --max-old-space-size=8192 scripts/agents/score.mjs
```
