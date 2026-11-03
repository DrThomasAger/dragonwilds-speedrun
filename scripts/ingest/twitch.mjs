// Twitch: chat replays (and, locally, Whisper transcripts) for the raid runners' VODs.
//   node scripts/ingest/twitch.mjs [--whisper] [--max-chat=N]
// Channels: twitch links on the runners' speedrun.com profiles
//   (data/kb/raw/speedrun/users.json, written by speedrun.mjs; looked up here if missing).
// VODs: twitch.tv/videos/<id> links on speedrun.com runs + each channel's recent
//   Dragonwilds VODs (archives, highlights, uploads).
// Chat: the public GQL endpoint the web player uses (VideoCommentsByOffsetOrCursor).
// Transcripts: with --whisper (or INGEST_WHISPER=1) and faster-whisper importable by
//   the ingest Python, yt-dlp pulls the VOD audio and scripts/ingest/whisper.py
//   transcribes it (small model, CPU). Otherwise transcript stays [] and
//   transcriptStatus says why.
// Output: data/kb/raw/twitch/<vod>.json {vod,channel,date,title,game,duration,chat:[{t,user,text}],transcript:[{t,text}]}
//         data/kb/raw/twitch/channels.json
import path from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RAW, RUNNERS, WORK, YTDLP, PYTHON, readJson, writeJson, logNew, run, sleep, now, clip, twitchVod, isMain, arg } from './lib.mjs';

const DIR = path.join(RAW, 'twitch');
const GQL = 'https://gql.twitch.tv/gql';
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const COMMENTS_HASH = 'b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a';
const DW = /dragonwilds|kuldra|scorned|raid/i;

async function gql(body) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(GQL, { method: 'POST', headers: { 'Client-Id': CLIENT_ID, 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) });
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * 2 ** i); continue; }
    const j = await r.json();
    if (j.errors?.length) { const e = new Error('GQL: ' + j.errors.map(x => x.message).join('; ')); e.gql = j.errors; throw e; }
    return j.data;
  }
  throw new Error('GQL: too many retries');
}

export async function channels() {
  const users = await readJson(path.join(RAW, 'speedrun', 'users.json'), {});
  const out = new Map();
  for (const u of Object.values(users)) {
    const login = (u.twitch || '').match(/twitch\.tv\/([\w]+)/i)?.[1]?.toLowerCase();
    if (login) out.set(login, { login, runner: u.name, src: 'speedrun.com profile' });
  }
  // runners named in the brief whose speedrun.com profile had no twitch link:
  // try their speedrun.com name as a twitch login (kept only if the user exists).
  for (const n of RUNNERS) {
    if ([...out.values()].some(c => c.runner?.toLowerCase() === n.toLowerCase())) continue;
    out.set(n.toLowerCase(), { login: n.toLowerCase(), runner: n, src: 'guess: speedrun.com name', guess: true });
  }
  return [...out.values()];
}

async function channelVods(login) {
  const d = await gql({ query: `query{user(login:${JSON.stringify(login)}){id login displayName videos(first:50,sort:TIME){edges{node{id title createdAt lengthSeconds broadcastType game{name}}}}}}` });
  if (!d.user) return null;
  return { user: d.user, vods: d.user.videos.edges.map(e => e.node) };
}

async function vodMeta(id) {
  const d = await gql({ query: `query{video(id:${JSON.stringify(id)}){id title createdAt lengthSeconds broadcastType owner{login} game{name}}}` });
  return d.video;
}

const toMsg = n => ({ t: n.contentOffsetSeconds, user: n.commenter?.displayName || n.commenter?.login || '?', text: (n.message?.fragments || []).map(f => f.text).join('') });

async function chatReplay(vod, maxMsgs) {
  const chat = [];
  let cursor = null, offset = 0, mode = 'cursor', pages = 0;
  const seen = new Set();
  for (;;) {
    const variables = cursor ? { videoID: vod, cursor } : { videoID: vod, contentOffsetSeconds: offset };
    let d;
    try { d = await gql({ operationName: 'VideoCommentsByOffsetOrCursor', variables, extensions: { persistedQuery: { version: 1, sha256Hash: COMMENTS_HASH } } }); }
    catch (e) {
      // cursor paging can need a client-integrity token; fall back to stepping the offset
      if (cursor && mode === 'cursor') { mode = 'offset'; cursor = null; offset = chat.length ? chat[chat.length - 1].t + 1 : 0; continue; }
      throw e;
    }
    const c = d.video?.comments;
    if (!c) break;
    const edges = c.edges || [];
    let added = 0;
    for (const e of edges) { if (seen.has(e.node.id)) continue; seen.add(e.node.id); chat.push(toMsg(e.node)); added++; }
    pages++;
    if (chat.length >= maxMsgs) return { chat: chat.slice(0, maxMsgs), truncated: true, mode, pages };
    if (!c.pageInfo?.hasNextPage || !edges.length) break;
    if (mode === 'cursor') cursor = edges[edges.length - 1].cursor;
    else { const last = edges[edges.length - 1].node.contentOffsetSeconds; offset = added ? last + 1 : offset + 30; }
    if (mode === 'cursor' && !cursor) { mode = 'offset'; offset = chat[chat.length - 1].t + 1; }
    await sleep(120);
  }
  return { chat, truncated: false, mode, pages };
}

async function whisperAvailable() {
  const r = await run(PYTHON, ['-c', 'import faster_whisper;print(faster_whisper.__version__)'], { timeout: 120000 });
  return r.code === 0 ? r.stdout.trim() : null;
}

async function transcribe(vod) {
  await mkdir(WORK, { recursive: true });
  const have = (await readdir(WORK)).find(f => f.startsWith(`twitch-${vod}.`) && !f.endsWith('.part'));
  let audio = have && path.join(WORK, have);
  if (!audio) {
    const r = await run(YTDLP, ['-f', 'Audio_Only/audio_only/bestaudio/worst', '--no-warnings', '--no-part', '-o', path.join(WORK, `twitch-${vod}.%(ext)s`), '--print', 'after_move:filepath', `https://www.twitch.tv/videos/${vod}`], { timeout: 60 * 60 * 1000 });
    if (r.code !== 0) throw new Error('audio download: ' + clip(r.stderr.trim().split('\n').pop(), 300));
    audio = r.stdout.trim().split('\n').pop();
  }
  const w = await run(PYTHON, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'whisper.py'), audio, process.env.INGEST_WHISPER_MODEL || 'small'], { timeout: 6 * 60 * 60 * 1000 });
  if (w.code !== 0) throw new Error('whisper: ' + clip(w.stderr.trim().split('\n').pop(), 300));
  const j = JSON.parse(w.stdout);
  return { transcript: j.segments.map(s => ({ t: s.t, text: s.text })), model: `faster-whisper ${j.model}`, language: j.language };
}

export async function ingestTwitch({ log = logNew, whisper = !!(arg('whisper', false) || process.env.INGEST_WHISPER === '1'), maxChat = +arg('max-chat', process.env.INGEST_TWITCH_MAX_CHAT || 30000), whisperMaxMin = +(process.env.INGEST_WHISPER_MAX_MIN || 60) } = {}) {
  const state = await readJson(path.join(DIR, '_state.json'), { vods: {} });
  const stats = { source: 'twitch', channels: 0, vodsFound: 0, newVods: 0, chatMessages: 0, transcribed: 0, transcriptsSkipped: 0, errors: [] };

  // ---- channels + their VOD lists
  const chans = [], vods = new Map();
  for (const c of await channels()) {
    try {
      const r = await channelVods(c.login);
      if (!r) { if (!c.guess) stats.errors.push(`twitch user ${c.login} not found`); continue; }
      chans.push({ ...c, id: r.user.id, displayName: r.user.displayName, vodCount: r.vods.length, dragonwildsVods: r.vods.filter(v => DW.test(v.game?.name || '') || DW.test(v.title || '')).map(v => v.id) });
      for (const v of r.vods) if (DW.test(v.game?.name || '') || DW.test(v.title || '')) vods.set(v.id, { ...v, login: r.user.login, via: 'channel' });
    } catch (e) { stats.errors.push(`${c.login}: ${e.message}`); }
    await sleep(300);
  }
  // ---- VODs linked from speedrun.com runs
  const runs = await readJson(path.join(RAW, 'speedrun', 'runs.json'), { runs: [] });
  for (const r of runs.runs) for (const u of r.videos) {
    const id = twitchVod(u);
    if (id && !vods.has(id)) {
      try { const m = await vodMeta(id); if (m) vods.set(id, { ...m, login: m.owner?.login, via: `speedrun.com run ${r.id}` }); else stats.errors.push(`vod ${id} (run ${r.id}) is gone`); }
      catch (e) { stats.errors.push(`vod ${id}: ${e.message}`); }
    }
  }
  stats.channels = chans.length; stats.vodsFound = vods.size;
  await writeJson(path.join(DIR, 'channels.json'), { fetchedAt: now(), channels: chans });

  const wver = whisper ? await whisperAvailable() : null;
  if (whisper && !wver) stats.errors.push('whisper requested but faster-whisper is not importable by ' + PYTHON);

  for (const v of vods.values()) {
    const file = path.join(DIR, `${v.id}.json`);
    const old = await readJson(file, null);
    const st = state.vods[v.id] || {};
    let doc = old || { vod: v.id, channel: v.login, date: v.createdAt?.slice(0, 10), title: v.title, game: v.game?.name || null, type: v.broadcastType || null, duration: v.lengthSeconds, via: v.via, chat: [], transcript: [], transcriptStatus: 'pending' };
    let changed = false;
    if (!st.chatDone) {
      try {
        process.stderr.write(`twitch chat ${v.id} ${clip(v.title, 50)}\n`);
        const c = await chatReplay(v.id, maxChat);
        doc.chat = c.chat; doc.chatTruncated = c.truncated || undefined; st.chatDone = now(); st.chatMode = c.mode; changed = true;
      } catch (e) { stats.errors.push(`chat ${v.id}: ${e.message}`); }
    }
    stats.chatMessages += doc.chat.length;
    if (!doc.transcript.length && !['too-long'].includes(st.transcript)) {
      if (!whisper) doc.transcriptStatus = 'needs-whisper: run locally with --whisper (faster-whisper), or provide a Whisper API key';
      else if (!wver) doc.transcriptStatus = 'needs-whisper: faster-whisper not installed';
      else if (v.lengthSeconds > whisperMaxMin * 60) { doc.transcriptStatus = `skipped: ${Math.round(v.lengthSeconds / 60)} min > INGEST_WHISPER_MAX_MIN=${whisperMaxMin}`; stats.transcriptsSkipped++; }
      else {
        try {
          process.stderr.write(`twitch whisper ${v.id} (${Math.round(v.lengthSeconds / 60)} min)\n`);
          const t = await transcribe(v.id);
          doc.transcript = t.transcript; doc.transcriptStatus = `ok: ${t.model} (${t.language})`; st.transcript = 'ok'; stats.transcribed++; changed = true;
          await log('twitch', 'transcript', v.id, doc.title);
        } catch (e) { doc.transcriptStatus = 'error: ' + clip(e.message, 200); stats.errors.push(`transcript ${v.id}: ${e.message}`); }
      }
      changed = changed || !old;
    }
    if (changed || !old) await writeJson(file, doc);
    if (!old) { stats.newVods++; await log('twitch', 'vod', v.id, `${v.login}: ${doc.title}`); }
    state.vods[v.id] = st;
    await writeJson(path.join(DIR, '_state.json'), state);
  }
  return stats;
}

if (isMain(import.meta)) console.log(JSON.stringify(await ingestTwitch()));
