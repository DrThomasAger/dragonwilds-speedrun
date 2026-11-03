# Exports that need your action

The Observatory has already ingested everything on this machine (`data/kb/agents/sources.json`). Some sources live only on the providers' servers, so you have to export them. Each section below gives the steps and where to put the file. After that, run:

```
node scripts/agents/ingest.mjs && node --max-old-space-size=8192 scripts/agents/score.mjs
```

Always save exports to **D:**, never to C:.

## 1. Gemini web/app chats (gemini.google.com): Google Takeout

There are no Gemini chats on disk, and Drive only has Gemini images.

1. Open https://takeout.google.com while signed in as **hanjoyoutaku@gmail.com**. Repeat later for crystallizationculture@gmail.com and hanjopurebuddha@gmail.com if you used Gemini there.
2. Click **Deselect all**.
3. Tick **My Activity**, then click **All activity data included**. In that list, **Deselect all** and tick only **Gemini Apps**.
4. Click **Multiple formats** and change *Activity records* from HTML to **JSON**.
5. Optionally tick **Gemini** (Gems and saved info) as well.
6. Click **Next step**: Export once, .zip, 2 GB. Click **Create export**.
7. When the email arrives, download the zip and extract it to `D:\labyrinth\Exports\Takeout\<account>\`. The file you need is `Takeout\My Activity\Gemini Apps\MyActivity.json`.
8. Tell Claude "ingest Gemini Takeout". The ingest step then gets a `gemini-web` parser for `MyActivity.json`. Each record has `time`, `title` (your prompt) and `safeHtmlItem` (the reply).

## 2. ChatGPT after November 2023

The newest export on disk is from 2023-11-12. It holds 3,265 unique conversations across 3 accounts.

1. Go to https://chatgpt.com → profile → **Settings → Data controls → Export data → Confirm export**.
2. Do this for each account you still use: hanjoyoutaku, crystallizationculture and hanjopurebuddha.
3. Download the zip from the email link. The link expires after 24 hours.
4. Extract each account to `D:\labyrinth\Github\OpenSophia\OpenSophia\data_exports\<n>-2026\`. Any folder under `D:\labyrinth\Github\OpenSophia\OpenSophia\data_exports` is picked up automatically.
5. Re-run ingest. Conversations are deduplicated by id, and the longest copy is kept.

## 3. Claude.ai web / desktop chats

These are separate from Claude Code, whose sessions are already ingested.

1. Go to https://claude.ai → **Settings → Privacy → Export data**.
2. Download the zip from the email. It contains `conversations.json`, `projects.json` and `users.json`.
3. Extract it to `D:\labyrinth\Exports\claude-ai\<date>\`.
4. Tell Claude "ingest claude.ai export". Its `conversations.json` has `chat_messages[]` with a `sender` of human/assistant and `created_at`. It is a different shape from the ChatGPT export, so it needs its own small parser.

## 4. Claude Code sessions that only survive as prompt history

131 sessions (Nov 2025 – Oct 2026) exist only in `~/.claude/history.jsonl`. Claude Code removed their transcripts (`cleanupPeriodDays`, which defaults to 30 days).

To keep future transcripts:

1. Add `"cleanupPeriodDays": 100000` to `C:\Users\Hanjo\.claude\settings.json`. Make this change yourself, or ask Claude to do it via `/config` (update-config).
2. To keep a copy on D:, schedule `robocopy C:\Users\Hanjo\.claude\projects D:\labyrinth\Exports\claude-code-projects /E /XO`. Then add that folder to the ingest's Claude roots.

## 5. Antigravity IDE

Antigravity was installed on 2026-11-02 and has no agent conversations yet. `trajectorySummaries` is empty and `~/.gemini/antigravity/conversations` does not exist. After you use the Agent Manager, re-run ingest: the `others` step checks those locations every run. Antigravity stores its trajectories as protobuf files under `~/.gemini/antigravity/conversations/*.pb`. If those appear, ask Claude to add a decoder.

## 6. Other assistants

- **Kimi, Grok, Perplexity, DeepSeek web:** each has *Settings → Export / Download data*. Save the file to `D:\labyrinth\Exports\<service>\` and ask for a parser.
- **GitHub Copilot (VS Code):** the 3 chat-session files are empty. Nothing to export.
- **LM Studio:** `~/.lmstudio` does not exist and `D:\LMStudio\LM Studio` is empty. If you move LM Studio's home to D:, the `conversations\*.conversation.json` files are parsed automatically.
