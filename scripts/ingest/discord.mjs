// Discord: the RSDW speedrunning server (https://discord.gg/aGZkuC5yK6,
// "Dragonwilds Speedrunning", guild 1363208210550620350) via the Discord REST API.
//   DISCORD_BOT_TOKEN=... node scripts/ingest/discord.mjs
// Without DISCORD_BOT_TOKEN it prints a skip notice and exits 0. See discord.md for
// how to get a token and get the bot into the server.
// Env:  DISCORD_BOT_TOKEN   bot token (required)
//       DISCORD_GUILD_ID    override the guild (default: resolved from the invite)
//       DISCORD_CHANNELS    optional regex of channel names to read (default: all readable)
// Output: data/kb/raw/discord/<channel-name>-<channelId>.jsonl, one message per line
//   {id,at,author,text,replyTo?,attachments?,embeds?,thread?}
// plus data/kb/raw/discord/channels.json. Incremental: per-channel last message id in
// data/kb/raw/discord/_state.json; each run only reads messages after it.
import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { RAW, readJson, writeJson, logNew, sleep, now, clip, isMain } from './lib.mjs';

const DIR = path.join(RAW, 'discord');
const API = 'https://discord.com/api/v10';
const INVITE = 'aGZkuC5yK6';
const TEXT_TYPES = new Set([0, 5, 10, 11, 12]); // text, announcement, threads

export async function ingestDiscord({ log = logNew, token = process.env.DISCORD_BOT_TOKEN } = {}) {
  if (!token) return { source: 'discord', skipped: 'DISCORD_BOT_TOKEN not set (see scripts/ingest/discord.md)' };
  const stats = { source: 'discord', channels: 0, newMessages: 0, errors: [] };
  const H = { Authorization: `Bot ${token}`, 'User-Agent': 'DiscordBot (https://github.com/drthomasager/dragonwilds-speedrun, 1.0)' };
  async function get(p) {
    for (let i = 0; i < 6; i++) {
      const r = await fetch(API + p, { headers: H });
      if (r.status === 429) { const j = await r.json().catch(() => ({})); await sleep(((j.retry_after || 1) * 1000) + 250); continue; }
      if (!r.ok) { const e = new Error(`${r.status} ${p} ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e; }
      if (+r.headers.get('x-ratelimit-remaining') === 0) await sleep(+r.headers.get('x-ratelimit-reset-after') * 1000 || 1000);
      return r.json();
    }
    throw new Error('429 ' + p);
  }

  let guild = process.env.DISCORD_GUILD_ID;
  if (!guild) guild = (await (await fetch(`${API}/invites/${INVITE}`)).json()).guild?.id;
  if (!guild) throw new Error('could not resolve guild from invite ' + INVITE);
  try { await get(`/guilds/${guild}`); }
  catch (e) { if (e.status === 403 || e.status === 404) return { ...stats, blocked: `bot is not in guild ${guild}: ask a server admin to add it (see discord.md)` }; throw e; }

  const only = process.env.DISCORD_CHANNELS ? new RegExp(process.env.DISCORD_CHANNELS, 'i') : null;
  const chans = (await get(`/guilds/${guild}/channels`)).filter(c => TEXT_TYPES.has(c.type));
  try { chans.push(...((await get(`/guilds/${guild}/threads/active`)).threads || [])); } catch (e) { stats.errors.push('threads: ' + e.message); }
  const state = await readJson(path.join(DIR, '_state.json'), { channels: {} });
  await mkdir(DIR, { recursive: true });
  const names = Object.fromEntries(chans.map(c => [c.id, c.name]));
  const read = [];

  for (const c of chans) {
    if (only && !only.test(c.name)) continue;
    const st = state.channels[c.id] || { after: '0' };
    const file = path.join(DIR, `${c.name.replace(/[^\w-]+/g, '_')}-${c.id}.jsonl`);
    let after = st.after, n = 0;
    try {
      for (;;) {
        const page = await get(`/channels/${c.id}/messages?limit=100&after=${after}`);
        if (!page.length) break;
        page.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        const lines = page.map(m => JSON.stringify({
          id: m.id, at: m.timestamp, author: m.author?.global_name || m.author?.username, text: clip(m.content || '', 4000),
          ...(m.message_reference?.message_id ? { replyTo: m.message_reference.message_id } : {}),
          ...(m.attachments?.length ? { attachments: m.attachments.map(a => a.url) } : {}),
          ...(m.embeds?.length ? { embeds: m.embeds.map(e => e.url || e.title).filter(Boolean) } : {}),
          ...(c.parent_id && names[c.parent_id] ? { thread: c.name } : {}),
        }));
        await appendFile(file, lines.join('\n') + '\n');
        for (const m of page) await log('discord', 'message', m.id, `#${c.name} ${m.author?.username}: ${clip(m.content || '', 80)}`);
        n += page.length;
        after = page[page.length - 1].id;
        state.channels[c.id] = { after, name: c.name, at: now() };
        await writeJson(path.join(DIR, '_state.json'), state);
        if (page.length < 100) break;
      }
      read.push({ id: c.id, name: c.name, type: c.type, newMessages: n });
      stats.newMessages += n; stats.channels++;
    } catch (e) {
      // 403 = the bot role can't see this channel (needs View Channel + Read Message History)
      stats.errors.push(`#${c.name}: ${e.message.slice(0, 120)}`);
    }
  }
  await writeJson(path.join(DIR, 'channels.json'), { fetchedAt: now(), guild, channels: read });
  return stats;
}

if (isMain(import.meta)) console.log(JSON.stringify(await ingestDiscord()));
