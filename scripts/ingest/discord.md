# Ingesting the RSDW speedrunning Discord

Server: **Dragonwilds Speedrunning**, invite https://discord.gg/aGZkuC5yK6
(guild id `1363208210550620350`, about 25 members; the invite resolves without auth).

Discord gives no way to read a server's history without being in it. Reading it with a
normal user account through the API ("self-botting") breaks Discord's Terms of Service,
so the script only uses a **bot**. A bot can be in the server only if one of the
server's admins adds it.

## What is needed

1. **A bot token** (you do this):
   1. Go to https://discord.com/developers/applications, click **New Application**, and name it (e.g. `Raid Lab KB`).
   2. Under **Bot**, click **Reset Token** and copy the token. This is `DISCORD_BOT_TOKEN`. Keep it secret.
   3. On the same **Bot** page, turn on **Message Content Intent**. Without it, the REST API returns messages with empty `content`. A bot in fewer than 100 servers can turn this on with no review.
   4. Turn **Public Bot** off so only you can invite it.
2. **The server admin adds the bot** (they do this). Send them this install link, with your application's id in place of `APP_ID`:

   ```
   https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot&permissions=66560
   ```

   `66560` = **View Channels** (1024) + **Read Message History** (65536). The bot needs nothing else: it never posts.
   The admin picks *Dragonwilds Speedrunning* and authorises. If some channels are private, the admin also gives the bot's role View Channel + Read Message History on those channels.
3. **Run the script** with the token:

   ```bash
   DISCORD_BOT_TOKEN=xxxx node scripts/ingest/discord.mjs          # bash
   $env:DISCORD_BOT_TOKEN='xxxx'; node scripts/ingest/discord.mjs   # PowerShell
   ```

   **On this PC you can skip the env var:** if `DISCORD_BOT_TOKEN` is not set, the script reads it
   from the Sangha Discord bot's `D:\labyrinth\Github\sangha-discord\.env` (override the path with
   `SANGHA_DISCORD_ENV`). Only that key is read. The same bot can serve both: install it on your own
   server with the Administrator link from `npm run invite` there, and ask the Dragonwilds Speedrunning
   admin to add it with the read-only `66560` link above.

   Optional: `DISCORD_CHANNELS='speedrun|raid|tech|route'` to read only matching channel names, and `DISCORD_GUILD_ID` to point at a different server.

   For the hourly GitHub Action, add the token as a repository secret named `DISCORD_BOT_TOKEN`. `ingest.yml` already passes it through. With no secret set, the step does nothing.

## What the script does

`scripts/ingest/discord.mjs`:
- With no `DISCORD_BOT_TOKEN`, it prints `{"skipped": ...}` and exits 0.
- It gets the guild id from the invite, then checks that the bot is in the guild. If it isn't, it reports `blocked` and stops.
- It lists the text and announcement channels and the active threads, then pages `GET /channels/{id}/messages?after=<last id>&limit=100` from oldest to newest. It honours `429 retry_after` and the rate-limit headers.
- It appends each message to `data/kb/raw/discord/<channel>-<id>.jsonl` as `{id, at, author, text, replyTo?, attachments?, embeds?, thread?}`. The last id read is kept per channel in `_state.json`, so each run only fetches new messages.
- It logs every new message to `data/kb/raw/ingest-log.jsonl`.

Not covered: archived threads and forum posts. Those need `GET /channels/{id}/threads/archived/public` per channel, which is easy to add if the server uses forums for routes or tech.
