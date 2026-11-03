# STYLE: writing as Dr. Thomas Ager

The house format for every post in the **Beat 6:50** series. It is extracted from four sources, quoted below:

| Code | Source | What it gives |
|---|---|---|
| **SITE** | His live blog source, `github.com/DrThomasAger/drthomasager.com` (`posts/*.md`, `build.py`, `mailing/intro-email.md`), last updated 26 Oct 2026. drthomasager.com itself is parked and the Ghost RSS/sitemap return only `/lander`, so the repo is the published writing. | Titles, openings, structure, closings, metadata |
| **MAP** | Drive: "Full Crystallization Culture Project Map 13 Nov 2025" | What the blog is for |
| **SUB** | thepromptdoctor.substack.com ("Get Good at Prompting Artificial Intelligence - Prompt Coach", 2 posts, 2023) | Pain-point voice |
| **SMILE** | `D:\labyrinth\Github\SmilePrompt\smile\README.md` | Bold / italics / name conventions, positive phrasing |
| **REG** | `D:\claude-temp\register\all-feature-requests.md`, `smile-requirements.md` | Standing writing rules |

## 1. What the blog is for

MAP defines it in one line:

> "**Dr. Thomas Ager, The Prompt Doctor (drthomasager.com):** SEO Blog: Ghost Blog/Mailing List SEO focused, Search aligned, Freebie, Uses SEO to drive people into using Smile, Targets Pain Points of Smile Audience With Article Titles"

and names the two article types:

> "Defining terms (Wiki-type e.g. "Modular Prompting", "What is Structured Prompt Engineering?"), Pain-point (Messy prompts, not following instructions, losing track of instructions over turns)"

So every post in this series is one of two kinds:

- **Definition post**: "What is a zoop?" Answers the term wiki-style, then teaches it.
- **Pain-point post**: "How do you skip the Garou Thane?" Names the problem a runner searches for, then solves it in numbered steps.

The SUB bio shows the pain-point formula in his own words: *"Tired of messy, unpredictable, and unreliable AI? Read for structured, modular & composable prompt engineering!"*

## 2. Titles and slugs

**Rule: the title is the searcher's question, in sentence case.** Proper nouns keep their capitals.

His 2026 titles (SITE):

- "What is agentiality?"
- "Do AI agents have memory?"
- "Are AI agents just prompts?"
- "Agent harness vs scaffolding"
- "AI agent vs subagent"
- "What is an AI agent? A definition you can build with" (pillar page: question + payoff)

Patterns, in order of use:

| Pattern | His example | Series example |
|---|---|---|
| What is X? | "What is a prompt language?" | "What is a zoop?" |
| Do / Are / Can X …? | "Do AI agents die when the session ends?" | "Does the Kuldra fight skip still work?" |
| How do you …? | (old Title Case pages: "Tutorial: Your First Structured Prompt") | "How do you skip the Garou Thane?" |
| X vs Y | "Agent harness vs scaffolding" | "TexasPete's 6:50 vs Nanobit's 7:01" |
| Question + payoff (pillar pages) | "What is an AI agent? A definition you can build with" | "How do you beat the 6:50 Scorned Wilderness world record?" |

**Slug = the title**, lowercased and hyphenated (`do-ai-agents-have-memory`). This series keeps short keyword slugs (`what-is-a-zoop`, `shattered-stronghold-garou-thane-skip`) because the series links were built on them; that matches his keyword-slug pillar pages. A pillar page may carry a keyword-stuffed slug, as he does: `slug: what-is-an-ai-agent-agentic-llm-definition`. Numbers appear only when real (6:50, 7:01, 1.0.1.2).

## 3. Opening

**The first sentence is a flat, wiki-style definition that answers the title.** No anecdote, no "In this post".

His openings (SITE):

> "Agentiality is the friction through which distinct agents come to exist. Where agency is usually spoken of as something an agent has, agentiality names the rubbing that produces the agent in the first place." (`what-is-agentiality`)

> "A language model keeps nothing between calls. An AI agent has memory through what its harness carries forward, which is the context window, memory files, transcripts and tool results." (`do-ai-agents-have-memory`)

> "An AI agent is more than a prompt, and the prompt is a real part of it. The prompt is one of the boundaries that produces the agent." (`are-ai-agents-just-prompts`)

> "Smile is a prompt language." (`what-is-smile`)

Series form: "***The Fragments zoop*** is the launch off the necromancer rocks that carries you straight into Fragments of Ghornfell."

## 4. Structure

SITE posts follow one fixed sequence. The series uses the same sequence, adapted:

1. **Definition lead**, 2 to 4 sentences, no heading.
2. **3 to 5 H2 sections**, sentence case, mostly the searcher's sub-questions ("What is an AI agent in simple terms?", "Is an LLM an agent?") or short statements ("Where agents break", "Editing memory changes the agent"). In this series the core sections are "What do you need?", "How do you do it?" (numbered steps, one action each) and "Why does it work?".
3. **At least one definitional table**, two or three columns. His: "Clause | What it means when building", "Term | Relation to the harness", "Kind | Where it lives | How long it lasts".
4. **"What this means when you run"**: exactly 3 action bullets (his: "What this means when building").
5. **"Read further"**: internal links, hub-and-spoke. His pillar page: "Each post below takes one question people search for and answers it from this definition."
6. **"Sources"**: the citations (Section 7). His essays carry a full "Notes" bibliography and cite even his own recordings ("Thomas Ager, recording '22 Oct at 2:02 pm' ... machine transcript").
7. **Freebie / signup block** (Section 8).
8. **"Key takeaways"**: exactly 3 bullets, each one full sentence ending in a full stop. Every SITE post closes this way.
9. Sign-off and series navigation.

Section length: 1 to 4 short paragraphs. No TL;DR and no FAQ block; Key takeaways does that job. Blockquotes hold **exact quotations** only.

## 5. Formatting

- **Bold** marks lead-ins and key words. SITE: "**Compaction is replacement.**", "**Mouths** mark sections". SMILE asks for more: "use **bold**, *italics* and ***bold+italics*** in all markdown section text [: **bold** important words, *italics* for grace and style, ***bold and italics*** names." REG (Claude Instructions): "at least one bold per paragraph". **Series rule: one or two bold key words per paragraph, never whole sentences except lead-ins.**
- *Italics* for grace, foreign or technical terms on first use, and short inline quotes. REG: "define every term in *(italic brackets)*".
- ***Bold italics*** for **names**: people (***Nanobit***, ***Dotxy***), named techniques on first mention, products (***(: SMILE***, ***Raid Lab***). This is the SMILE name-tag convention: "start with bold italics name tag".
- `Code` only for key inputs: `Q`, `Esc`.
- **No em dashes.** His September and October 2026 posts drop them for commas, full stops and "which means".
- **No emoji in prose.** His brand emoticons `(-:` and `:-)` appear in emails and sign-offs only.
- **British spelling**: behaviour, armour, practise (verb), summarises.

## 6. Voice

- **Plain, short, declarative sentences.** SITE: "The weights are unchanged between the cases. The cut changed."
- **Confident assertions, zero hedging.** SITE states large claims flatly: "Seen this way, a language model is a machine that does nothing but produce karma, quickly and at enormous scale." No "might", "perhaps", "arguably", "it seems". Where a fact is unverified, state what is verified and turn the rest into a **test step**: "Test it three times on 1.0.1.2 before you route it."
- **Positive phrasing only.** SMILE: "rewriting negatives so that positive articulations can be used"; "written only in positive". REG #143: "speak only in the positive"; REG #152 "positive language only". Write "Land on the rubble tip", never "Don't miss the rubble".
- **No contrast framing.** REG #45: "never negate/contrast ("not X but Y", "merely")". State the true thing directly.
- **Person**: "you" for the reader in steps, "I" for the author's own measurements. Imperatives in numbered steps.
- **Define jargon on first use**, for a reader with zero knowledge (SMILE: "use also definitions after any long or complex words explaining in direct address to the user the definition, assuming 0 knowledge user"; REG #36 "plain words, short, no jargon").
- **Invite direct experience** (SMILE: "**Copy and paste** the example **now** into your favorite language model and discover how ***(: Smile*** works through direct experience.").
- **Credit generously, follow the credit chain** ("***SectorTSWG*** via ***Sir_Rebral***"). SITE credits even AI co-authors in the byline ("Dr. Thomas Ager, Opus 5.5").
- **Never invent specifics** (REG #31: "only reessarch verified sources"; #32: "Never hallucinate specifics").
- **Recurring phrases** to echo: "a definition you can build with" becomes "**a route you can run with**"; the sign-off "May this writing benefit all beings."

## 7. Citations

Every claim carries a **short verbatim quote** and a **timestamped link** `https://youtu.be/<id>?t=<seconds>`:

`- ***Nanobit***: "Can do 4 air dash instead of 3 towards 1st air anima pillar" ([7:01 run, 0:51](https://youtu.be/doVQ9Ph256g?t=51))`

Description and comment quotes link `?t=0` or the moment they describe. Jagex quotes link the Steam post; rules quotes link speedrun.com.

## 8. Freebie, signup and sign-off

His CTAs (SITE), verbatim:

- Inline signup: `[[join: agent-paper-2026 | Receive each new agent post by email | Join the List]]`, rendering "We'll never share your info with anyone."
- Lead magnet: "The Free Guide for Using Smile — Free: Arrives with the welcome email when you join the mailing list, and is yours to keep."
- Home hero: "New posts go out by email when they are written." Button: "Join the Mailing List".
- Welcome email: "Thank you for the trust of your inbox." ... "May this writing be of benefit to you. / Dr Thomas Ager"
- Footer: "May this writing benefit all beings."

Series block (every post, before Key takeaways):

> **Free: the Beat 6:50 Raid Lab and checklist.** Race your runs against the 6:50 and the 7:01 on one clock, loop every skip in this series and track your consistency. [Open the Raid Lab](https://drthomasager.github.io/dragonwilds-speedrun/). Join the mailing list and the printable Beat 6:50 pre-run checklist arrives with the welcome email, yours to keep.

On Ghost, add a **signup card** under this block (Ghost's native equivalent of `[[join: …]]`), labelled "Receive each new Beat 6:50 post by email".

Sign-off, every post:

```
***Dr. Thomas Ager***

May this writing benefit all beings.
```

## 9. Ghost metadata

| Field | Rule | His practice (SITE `build.py`) |
|---|---|---|
| `title` | Searcher's question, sentence case | `<title>` = "{Title} — Dr Thomas Ager" (added by the theme) |
| `slug` | Title, lowercased, hyphenated | `slug: what-is-an-ai-agent-agentic-llm-definition` |
| `excerpt` | Restates the question, answers it in 1 to 2 sentences, 120 to 200 characters | "Do AI agents have memory? A language model keeps nothing between calls, and an agent remembers through its context, memory files and records." |
| `tags` | `#beat-650` (internal) + pillar slug + 2 to 4 literal search-query tags, lowercase | `tags: do ai agents have memory, ai agent memory, what is ai agent memory, context window, memory files` |
| `author` | `Dr. Thomas Ager` | "Dr. Thomas Ager, Opus 5.5" in the authors field |
| `meta_title` | Search question, up to 60 characters | |
| `meta_description` | Same formula as the excerpt, 140 to 160 characters | description = og = twitter description |
| `feature_image_alt` | Literal description of a frame from the cited clip | He uses glyph card art instead of images |
| `canonical` | `https://drthomasager.com/<slug>/` | canonical on every page |
| `series_order`, `prev`, `next`, `status` | Set by `tools/build_blog.py` | |

## 10. Ten rules in one place

1. Title = the searcher's question, sentence case; slug = title.
2. First sentence = flat wiki-style definition that answers the title.
3. Positive phrasing only; no "not X but Y", no "merely".
4. Confident assertions, zero hedging; unverified facts become test steps.
5. **Bold** key words and lead-ins, *italics* for grace and definitions, ***bold italics*** for names.
6. Question-style H2s, numbered one-action steps, one definitional table.
7. Every claim: short verbatim quote + timestamped link; every technique: finder named.
8. Close with What this means when you run (3), Read further, Sources, freebie, Key takeaways (3 full sentences).
9. British spelling, no em dashes, no emoji.
10. Sign off "***Dr. Thomas Ager***" and "May this writing benefit all beings."
